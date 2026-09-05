import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  assessPayment,
  diagnosePayment,
  validateDecision,
  analyzeBatch,
  RECOVERY_POLICY_CONFIG,
} from '../src/lib/recovery/index.ts';

function createMockPayment(overrides = {}) {
  return {
    payment_id: 'pay_test_001',
    customer_id: 'cust_test_001',
    customer_name: 'Test Customer',
    customer_email: 'test@example.com',
    amount: 1500,
    currency: 'INR',
    status: 'failed',
    failure_reason: 'timeout',
    attempt_count: 1,
    created_at: new Date().toISOString(),
    last_attempt_at: new Date().toISOString(),
    subscription_status: 'active',
    previous_successful_payments: 5,
    previous_failed_payments: 0,
    payment_method_type: 'card',
    payment_method_detail: 'HDFC Visa ending in 4242',
    ...overrides,
  };
}

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

async function runTests() {
  console.log('=======================================================');
  console.log('  RecoverAI Phase 2 — Recovery Decision Engine Tests');
  console.log('=======================================================\n');

  console.log('--- TEST SUITE: 15 Core Decision & Policy Scenarios ---\n');

  // Scenario 1: Timeout + healthy customer → retry_payment
  {
    const p = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: 1,
      previous_successful_payments: 8,
      previous_failed_payments: 0,
    });
    const d = assessPayment(p);
    assert(
      d.action === 'retry_payment' && d.classification === 'recoverable' && d.risk_level === 'low',
      `Test 1: Timeout + healthy customer → retry_payment (action: ${d.action}, class: ${d.classification})`
    );
  }

  // Scenario 2: Gateway error + healthy customer → retry_payment
  {
    const p = createMockPayment({
      failure_reason: 'gateway_error',
      attempt_count: 1,
      previous_successful_payments: 10,
      previous_failed_payments: 0,
    });
    const d = assessPayment(p);
    assert(
      d.action === 'retry_payment' && d.classification === 'recoverable',
      `Test 2: Gateway error + healthy customer → retry_payment (action: ${d.action})`
    );
  }

  // Scenario 3: Timeout + max attempts reached → no retry
  {
    const p = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES, // 2
      previous_successful_payments: 10,
      previous_failed_payments: 0,
    });
    const d = assessPayment(p);
    assert(
      d.action !== 'retry_payment' && d.action === 'escalate_to_human',
      `Test 3: Timeout + max attempts (${p.attempt_count}) → no retry, escalated (action: ${d.action})`
    );
  }

  // Scenario 4: Gateway error + max attempts reached → no retry
  {
    const p = createMockPayment({
      failure_reason: 'gateway_error',
      attempt_count: RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES,
      previous_successful_payments: 5,
      previous_failed_payments: 0,
    });
    const d = assessPayment(p);
    assert(
      d.action !== 'retry_payment' && d.action === 'escalate_to_human',
      `Test 4: Gateway error + max attempts (${p.attempt_count}) → no retry, escalated (action: ${d.action})`
    );
  }

  // Scenario 5: Expired card → payment method update (never retry)
  {
    const p = createMockPayment({
      failure_reason: 'expired_card',
      attempt_count: 1,
      payment_method_detail: 'Visa Card (Expired 08/25)',
    });
    const d = assessPayment(p);
    assert(
      d.action === 'request_payment_method_update' && d.action !== 'retry_payment',
      `Test 5: Expired card → request_payment_method_update, never retry (action: ${d.action})`
    );
  }

  // Scenario 6: Insufficient funds → contact_customer
  {
    const p = createMockPayment({
      failure_reason: 'insufficient_funds',
      attempt_count: 1,
      previous_successful_payments: 4,
      previous_failed_payments: 1,
    });
    const d = assessPayment(p);
    assert(
      d.action === 'contact_customer' && d.action !== 'retry_payment',
      `Test 6: Insufficient funds (1st attempt) → contact_customer (action: ${d.action})`
    );
  }

  // Scenario 7: Repeated insufficient funds → escalation
  {
    const p = createMockPayment({
      failure_reason: 'insufficient_funds',
      attempt_count: 2,
      previous_successful_payments: 2,
      previous_failed_payments: 3,
    });
    const d = assessPayment(p);
    assert(
      d.action === 'escalate_to_human' && d.classification === 'requires_escalation',
      `Test 7: Repeated insufficient funds (${p.attempt_count} attempts) → escalate_to_human (action: ${d.action})`
    );
  }

  // Scenario 8: Authentication failure → customer involvement (never auto retry)
  {
    const p = createMockPayment({
      failure_reason: 'authentication_failure',
      attempt_count: 1,
    });
    const d = assessPayment(p);
    assert(
      (d.action === 'contact_customer' || d.action === 'escalate_to_human') && d.action !== 'retry_payment',
      `Test 8: Authentication failure → customer involvement required (action: ${d.action})`
    );
  }

  // Scenario 9: Checkout abandonment → customer contact (commercial recovery opportunity)
  {
    const p = createMockPayment({
      status: 'abandoned',
      failure_reason: 'checkout_abandoned',
      attempt_count: 1,
    });
    const d = assessPayment(p);
    assert(
      d.action === 'contact_customer' && d.classification === 'recoverable',
      `Test 9: Checkout abandonment → contact_customer recovery opportunity (action: ${d.action})`
    );
  }

  // Scenario 10: Repeated bank declines → escalation
  {
    const p = createMockPayment({
      failure_reason: 'bank_decline',
      attempt_count: 2,
      previous_successful_payments: 5,
    });
    const d = assessPayment(p);
    assert(
      d.action === 'escalate_to_human',
      `Test 10: Repeated bank declines (attempt: ${p.attempt_count}) → escalate_to_human (action: ${d.action})`
    );
  }

  // Scenario 11: Strong payment history affects decision
  {
    const strongPayment = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: 1,
      previous_successful_payments: 12,
      previous_failed_payments: 0,
    });
    const weakPayment = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: 1,
      previous_successful_payments: 0,
      previous_failed_payments: 4,
    });
    const dStrong = assessPayment(strongPayment);
    const dWeak = assessPayment(weakPayment);
    assert(
      dStrong.confidence > dWeak.confidence && dStrong.reason.includes('High-reputation'),
      `Test 11: Strong history elevates confidence & explains context (strong conf: ${dStrong.confidence} vs weak conf: ${dWeak.confidence})`
    );
  }

  // Scenario 12: Poor payment history affects decision
  {
    const weakPayment = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: 1,
      previous_successful_payments: 1,
      previous_failed_payments: 5,
    });
    const dWeak = assessPayment(weakPayment);
    assert(
      dWeak.risk_level === 'medium' && dWeak.reason.includes('poor historical track record'),
      `Test 12: Poor payment history elevates risk assessment and explains history in reason (risk: ${dWeak.risk_level})`
    );
  }

  // Scenario 13: Policy rejects retry above retry limit (override enforcement)
  {
    const p = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: 3, // strictly exceeds MAX_AUTOMATIC_RETRIES (2)
    });
    // Call raw diagnosis directly: proposed action might be retry if naive
    const proposed = {
      classification: 'recoverable',
      diagnosis: 'Transient timeout',
      action: 'retry_payment',
      confidence: 0.9,
      reason: 'Transient network failure',
      risk_level: 'low',
    };
    const validation = validateDecision(proposed, p);
    assert(
      validation.allowed === false && validation.overridden === true && validation.final_action === 'escalate_to_human',
      `Test 13: Policy validation strictly rejects retry when attempts (${p.attempt_count}) >= limit (overridden: ${validation.overridden}, final: ${validation.final_action})`
    );
  }

  // Scenario 14: Every automated recommendation has an explicit stop condition
  {
    const failureTypes = [
      'timeout',
      'gateway_error',
      'bank_decline',
      'insufficient_funds',
      'expired_card',
      'authentication_failure',
      'checkout_abandoned',
    ];
    let allHaveStop = true;
    for (const f of failureTypes) {
      const p = createMockPayment({ failure_reason: f, attempt_count: 1 });
      const d = assessPayment(p);
      if (!d.stop_condition || d.stop_condition.trim().length < 5) {
        allHaveStop = false;
        console.error(`Missing stop condition for failure: ${f}`);
      }
    }
    assert(
      allHaveStop,
      'Test 14: Every failure recommendation contains a verified, explicit stop condition'
    );
  }

  // Scenario 15: Confidence is strictly bounded between 0.0 and 1.0
  {
    let allBounded = true;
    const testCases = [
      createMockPayment({ failure_reason: 'timeout', attempt_count: 1 }),
      createMockPayment({ failure_reason: 'gateway_error', attempt_count: 3 }),
      createMockPayment({ failure_reason: 'expired_card' }),
      createMockPayment({ status: 'successful' }),
      createMockPayment({ status: 'pending' }),
      createMockPayment({ status: 'abandoned' }),
    ];
    for (const tc of testCases) {
      const d = assessPayment(tc);
      if (typeof d.confidence !== 'number' || d.confidence < 0.0 || d.confidence > 1.0 || isNaN(d.confidence)) {
        allBounded = false;
        console.error(`Invalid confidence value: ${d.confidence} for payment ${tc.payment_id}`);
      }
    }
    assert(
      allBounded,
      'Test 15: All decision confidence metrics remain strictly bounded between 0.0 and 1.0'
    );
  }

  console.log('\n--- TEST SUITE: Batch Analysis & SQLite Database Integration ---\n');

  // Test Batch Analysis on SQLite Database records
  const dbPath = path.join(process.cwd(), 'data', 'recoverai.db');
  if (fs.existsSync(dbPath)) {
    const db = new DatabaseSync(dbPath);
    const atRiskRecords = db.prepare("SELECT * FROM payments WHERE status IN ('failed', 'abandoned')").all();

    console.log(`Loaded ${atRiskRecords.length} at-risk records from local SQLite.`);

    const batchResult = analyzeBatch(atRiskRecords);
    const { metrics, decisions } = batchResult;

    assert(
      metrics.payments_analyzed === atRiskRecords.length,
      `Batch Telemetry: payments_analyzed (${metrics.payments_analyzed}) matches input count`
    );

    assert(
      metrics.potentially_recoverable_value > 0 && metrics.potentially_recoverable_value <= metrics.total_revenue_at_risk,
      `Financial Accuracy: Potentially Recoverable Value (₹${metrics.potentially_recoverable_value.toLocaleString('en-IN')}) <= Total Revenue at Risk (₹${metrics.total_revenue_at_risk.toLocaleString('en-IN')})`
    );

    const actionSum =
      metrics.retry_recommendation_count +
      metrics.customer_contact_count +
      metrics.payment_method_update_count +
      metrics.escalation_count +
      metrics.do_nothing_count;

    assert(
      actionSum === metrics.payments_analyzed,
      `Action Completeness: sum of categorized actions (${actionSum}) exactly equals total analyzed (${metrics.payments_analyzed})`
    );

    // Verify read-only guarantee: Database was NOT modified
    const postCount = db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'successful'").get().count;
    assert(
      postCount === 20, // 20 successful payments seeded in Phase 1
      `Read-Only Invariant: Zero payments executed; successful record count unchanged (${postCount} === 20)`
    );

    db.close();
  }

  console.log('\n=======================================================');
  if (failed === 0) {
    console.log(`  ALL ${passed} PHASE 2 TESTS PASSED PERFECTLY!`);
  } else {
    console.error(`  TEST RUN FAILED: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal error running decision engine tests:', err);
  process.exit(1);
});
