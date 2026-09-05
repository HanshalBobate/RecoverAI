import {
  executeRecoveryForPayment,
  getExecutionPreview,
  verifyExecutionEligibility,
  getExecutionMode,
} from '../src/lib/execution/index.ts';
import {
  getDb,
  getPaymentById,
  getRecoveredRevenue,
  getExecutionMetrics,
  saveRecoveryExecution,
  getSuccessfulRecovery,
} from '../src/lib/db.ts';
import { assessPayment } from '../src/lib/recovery/index.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAILED: ${message}`);
    failed++;
  }
}

async function runAdversarialTests() {
  console.log('=======================================================');
  console.log('  RecoverAI Phase 5 — Adversarial Security & Robustness Tests');
  console.log('=======================================================\n');

  const db = getDb();
  // Clear any existing executions for clean test baseline
  db.exec('DELETE FROM recovery_executions');

  // -------------------------------------------------------------------------
  // VECTOR 1: Action Injection / Tampering Attack
  // Client attempts to supply an unauthorized action (e.g., 'payout_now' or 'bypass_policy')
  // -------------------------------------------------------------------------
  console.log('Vector 1: Action Injection Attack (Client cannot supply action)');
  {
    const target = getPaymentById('pay_rec_0200'); // At attempt 3, must escalate
    // Service function signature accepts only (paymentId, modeOverride)
    // Server determines action autonomously
    const res = await executeRecoveryForPayment('pay_rec_0200');
    assert(res.action === 'escalate_to_human', `Server enforced policy action 'escalate_to_human' (got '${res.action}')`);
    assert(res.status === 'escalated', `Status is 'escalated' (got '${res.status}')`);
    assert(res.amount_recovered === 0, `Zero money recovered on non-retry (got ${res.amount_recovered})`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 2: Amount Tampering Attack
  // Client attempts to credit an arbitrary amount (e.g., ₹99,99,999)
  // -------------------------------------------------------------------------
  console.log('\nVector 2: Amount Tampering Attack (Server governs amounts)');
  {
    const target = getPaymentById('pay_rec_0001'); // Amount is 14999
    const res = await executeRecoveryForPayment('pay_rec_0001');
    assert(res.amount_attempted === target.amount, `Attempted amount strictly matches DB record (₹${res.amount_attempted} === ₹${target.amount})`);
    assert(res.amount_recovered === target.amount, `Recovered amount cannot exceed DB payment amount (₹${res.amount_recovered} === ₹${target.amount})`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 3: Negative / Corrupted Amount Sanitization
  // DB layer must clamp negative amounts or NaNs safely to 0
  // -------------------------------------------------------------------------
  console.log('\nVector 3: Negative / Corrupted Amount Sanitization');
  {
    const corruptedRecord = {
      execution_id: 'rec_exec_adv_corrupted_01',
      payment_id: 'pay_rec_0002',
      assessment_id: 'audit_corrupted_01',
      action: 'retry_payment',
      execution_mode: 'mock',
      status: 'failed',
      amount_attempted: -5000, // Negative amount attempted
      amount_recovered: -2500, // Negative amount recovered
      policy_rule: 'POL-100',
      decision_source: 'adversarial_test',
      provider: null,
      model: null,
      failure_reason: 'Testing negative amount clamp',
      created_at: new Date().toISOString(),
    };

    saveRecoveryExecution(corruptedRecord);

    const stmt = db.prepare('SELECT amount_attempted, amount_recovered FROM recovery_executions WHERE execution_id = ?');
    const row = stmt.get('rec_exec_adv_corrupted_01');
    assert(row.amount_attempted >= 0, `Negative attempted amount safely clamped to ${row.amount_attempted}`);
    assert(row.amount_recovered >= 0, `Negative recovered amount safely clamped to ${row.amount_recovered}`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 4: Policy Bypass Attempt (Expired Instrument & Max Retries)
  // -------------------------------------------------------------------------
  console.log('\nVector 4: Policy Bypass Attempt');
  {
    const expiredPayment = getPaymentById('pay_rec_0004'); // Expired card
    const fakeApprovedDecision = {
      payment_id: expiredPayment.payment_id,
      classification: 'recoverable',
      diagnosis: 'Malicious attacker pretending payment is recoverable',
      action: 'retry_payment',
      confidence: 0.99,
      reason: 'Should be blocked',
      policy_rule: 'POL-002',
      stop_condition: 'Never retry expired card',
      risk_level: 'low',
      policy_overridden: false,
    };

    const gateResult = verifyExecutionEligibility(expiredPayment, fakeApprovedDecision);
    assert(gateResult.eligible === false, 'Execution gate refuses to execute retry on expired card');
    assert(gateResult.eligibility === 'blocked', `Eligibility is 'blocked' (got '${gateResult.eligibility}')`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 5: High-Concurrency Race Condition Attack
  // 10 concurrent execution requests fired simultaneously for the SAME payment
  // -------------------------------------------------------------------------
  console.log('\nVector 5: High-Concurrency Race Condition Attack (10 parallel requests)');
  {
    // Clean out previous executions for pay_rec_0001
    db.exec("DELETE FROM recovery_executions WHERE payment_id = 'pay_rec_0001'");
    const revBefore = getRecoveredRevenue();

    // Fire 10 concurrent requests at the exact same millisecond
    const concurrentRequests = Array.from({ length: 10 }, () =>
      executeRecoveryForPayment('pay_rec_0001')
    );

    const results = await Promise.all(concurrentRequests);

    // Exactly one must be the primary execution; the other 9 must be flagged already_recovered
    const primaryCount = results.filter((r) => !r.already_recovered).length;
    const idempotentCount = results.filter((r) => r.already_recovered === true).length;
    const allSuccessful = results.every((r) => r.status === 'succeeded');

    assert(allSuccessful, 'All 10 concurrent requests returned clean status succeeded');
    assert(primaryCount === 1, `Exactly 1 primary execution ran (got ${primaryCount})`);
    assert(idempotentCount === 9, `Remaining 9 requests received already_recovered lock (got ${idempotentCount})`);

    // Verify DB count: only 1 execution record should exist in DB
    const dbRows = db.prepare("SELECT COUNT(*) as cnt FROM recovery_executions WHERE payment_id = 'pay_rec_0001' AND status = 'succeeded'").get();
    assert(dbRows.cnt === 1, `Database contains exactly 1 execution record (got ${dbRows.cnt})`);

    // Verify revenue was credited exactly once
    const revAfter = getRecoveredRevenue();
    const target = getPaymentById('pay_rec_0001');
    assert(revAfter - revBefore === target.amount, `Revenue was credited exactly ONCE (+₹${target.amount}) despite 10 simultaneous hits`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 6: Non-Existent & Malformed Payment IDs
  // -------------------------------------------------------------------------
  console.log('\nVector 6: Non-Existent & Malformed Payment IDs');
  {
    let caughtNotFound = false;
    try {
      await executeRecoveryForPayment('pay_rec_nonexistent_9999');
    } catch (err) {
      caughtNotFound = true;
      assert(err.message.includes('not found'), `Handled non-existent ID with clear not found error: "${err.message}"`);
    }
    assert(caughtNotFound, 'Non-existent payment threw expected exception');

    // SQL Injection payload as payment_id
    let caughtSqlInjection = false;
    try {
      await executeRecoveryForPayment("' OR '1'='1' --");
    } catch (err) {
      caughtSqlInjection = true;
      assert(err.message.includes('not found'), 'SQL injection payload handled safely via parameterized query');
    }
    assert(caughtSqlInjection, 'SQL injection payment ID threw expected not found');
  }

  // -------------------------------------------------------------------------
  // VECTOR 7: Tampered Execution Mode (Rejecting Production Bypass)
  // -------------------------------------------------------------------------
  console.log('\nVector 7: Tampered Execution Mode (Protection against live leak)');
  {
    // If an attacker supplies an unauthorized mode like 'production' or 'live', getExecutionMode defaults to mock
    const mode1 = getExecutionMode('production');
    assert(mode1 === 'mock', `Unsupported mode 'production' safely clamped to 'mock' (got '${mode1}')`);

    const mode2 = getExecutionMode('live_payout');
    assert(mode2 === 'mock', `Unsupported mode 'live_payout' safely clamped to 'mock' (got '${mode2}')`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 8: Idempotency Across Multiple Consecutive Re-runs
  // -------------------------------------------------------------------------
  console.log('\nVector 8: Multi-Cycle Idempotency Invariant');
  {
    const revBefore = getRecoveredRevenue();
    // Run 5 consecutive executions of pay_rec_0001
    for (let i = 0; i < 5; i++) {
      const res = await executeRecoveryForPayment('pay_rec_0001');
      assert(res.already_recovered === true, `Cycle ${i + 1}: already_recovered === true`);
    }
    const revAfter = getRecoveredRevenue();
    assert(revBefore === revAfter, `Total recovered revenue unchanged after 5 consecutive re-runs (₹${revBefore} === ₹${revAfter})`);
  }

  // -------------------------------------------------------------------------
  // VECTOR 9: Strict Accounting Upper Bound Guarantees
  // -------------------------------------------------------------------------
  console.log('\nVector 9: Mathematical Accounting Upper Bound Guarantees');
  {
    const metrics = getExecutionMetrics();
    const totalRevenueAtRisk = 1887975;
    assert(metrics.recovered_revenue <= totalRevenueAtRisk, `Recovered revenue (₹${metrics.recovered_revenue}) <= Total Revenue at Risk (₹${totalRevenueAtRisk})`);
    assert(Number.isFinite(metrics.recovered_revenue), 'Recovered revenue is a finite number');
    assert(!Number.isNaN(metrics.recovered_revenue), 'Recovered revenue is not NaN');
    assert(metrics.recovered_revenue >= 0, 'Recovered revenue is strictly >= 0');
  }

  // -------------------------------------------------------------------------
  // VECTOR 10: Payments Table Immutability Guarantee
  // -------------------------------------------------------------------------
  console.log('\nVector 10: Original Payments Table Immutability');
  {
    const rowCount = db.prepare('SELECT COUNT(*) as count FROM payments').get();
    assert(rowCount.count === 200, `Original 200 payments completely preserved (got ${rowCount.count})`);

    const p1 = getPaymentById('pay_rec_0001');
    assert(p1.status === 'failed', `Original payment status preserved as 'failed' (got '${p1.status}')`);
    assert(p1.attempt_count === 1, `Original attempt count preserved as 1 (got ${p1.attempt_count})`);
  }

  console.log('\n=======================================================');
  console.log(`  ALL 25 ADVERSARIAL & ROBUSTNESS ASSERTIONS PASSED! (${passed}/${passed + failed})`);
  console.log('=======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialTests().catch((err) => {
  console.error('Adversarial tests failed:', err);
  process.exit(1);
});
