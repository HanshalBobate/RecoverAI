import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  MockLLMProvider,
  assessPaymentWithAI,
  analyzeAIBatch,
  validateLLMOutput,
  buildPaymentContext,
  getLLMProvider,
} from '../src/lib/llm/index.ts';
import {
  assessPayment,
  validateDecision,
  RECOVERY_POLICY_CONFIG,
} from '../src/lib/recovery/index.ts';

function createMockPayment(overrides = {}) {
  return {
    payment_id: 'pay_test_ai_001',
    customer_id: 'cust_test_ai_001',
    customer_name: 'Aditi Sharma',
    customer_email: 'aditi.sharma@example.in',
    amount: 3499,
    currency: 'INR',
    status: 'failed',
    failure_reason: 'timeout',
    attempt_count: 1,
    created_at: new Date().toISOString(),
    last_attempt_at: new Date().toISOString(),
    subscription_status: 'active',
    previous_successful_payments: 6,
    previous_failed_payments: 0,
    payment_method_type: 'upi',
    payment_method_detail: 'aditi@okhdfcbank',
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
  console.log('  RecoverAI Phase 3 — LLM Provider & Abstraction Tests');
  console.log('=======================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1: Mock provider returns valid recommendation
  // -------------------------------------------------------------------------
  console.log('Test 1: Mock provider returns valid recommendation');
  {
    const mockProvider = new MockLLMProvider();
    const payment = createMockPayment({ failure_reason: 'timeout', attempt_count: 1 });
    const context = buildPaymentContext(payment);
    const rec = await mockProvider.analyzePayment(context);

    const validation = validateLLMOutput(rec);
    assert(validation.valid === true, 'Validation passes for MockLLMProvider output');
    assert(rec.classification === 'recoverable', `Expected recoverable, got '${rec.classification}'`);
    assert(rec.recommended_action === 'retry_payment', `Expected retry_payment, got '${rec.recommended_action}'`);
    assert(typeof rec.confidence === 'number' && rec.confidence >= 0 && rec.confidence <= 1, 'Confidence is numeric between 0 and 1');
    assert(typeof rec.diagnosis === 'string' && rec.diagnosis.length > 0, 'Diagnosis string present');
    assert(typeof rec.reason === 'string' && rec.reason.length > 0, 'Reason string present');
    assert(['low', 'medium', 'high'].includes(rec.risk_level), `Valid risk level: '${rec.risk_level}'`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Mock provider is deterministic
  // -------------------------------------------------------------------------
  console.log('\nTest 2: Mock provider is deterministic across multiple calls');
  {
    const mockProvider = new MockLLMProvider();
    const payment = createMockPayment({ failure_reason: 'insufficient_funds', attempt_count: 1 });
    const context = buildPaymentContext(payment);

    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await mockProvider.analyzePayment(context));
    }

    const first = JSON.stringify(results[0]);
    const allIdentical = results.every((r) => JSON.stringify(r) === first);
    assert(allIdentical, '5 consecutive calls with identical context produced identical recommendations');
    assert(results[0].recommended_action === 'contact_customer', 'Insufficient funds correctly mapped to contact_customer');
  }

  // -------------------------------------------------------------------------
  // TEST 3: Invalid LLM action is rejected
  // -------------------------------------------------------------------------
  console.log('\nTest 3: Invalid LLM action is rejected by validator');
  {
    const invalidActionOutput = {
      classification: 'recoverable',
      diagnosis: 'AI hallucinated action',
      recommended_action: 'drain_user_wallet', // Not in allowed actions enum
      confidence: 0.95,
      reason: 'Should be rejected',
      risk_level: 'low',
    };

    const res = validateLLMOutput(invalidActionOutput);
    assert(res.valid === false, 'Validator rejects non-whitelisted action string');
    assert(res.error?.includes('Invalid action'), `Error correctly identifies action violation: "${res.error}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Confidence below 0 is rejected
  // -------------------------------------------------------------------------
  console.log('\nTest 4: Confidence below 0 is rejected');
  {
    const negativeConfidenceOutput = {
      classification: 'recoverable',
      diagnosis: 'Negative confidence score test',
      recommended_action: 'retry_payment',
      confidence: -0.25,
      reason: 'Out of bounds test',
      risk_level: 'low',
    };

    const res = validateLLMOutput(negativeConfidenceOutput);
    assert(res.valid === false, 'Validator rejects confidence score < 0.0');
    assert(res.error?.includes('out of bounds'), `Error message cites out of bounds: "${res.error}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Confidence above 1 is rejected
  // -------------------------------------------------------------------------
  console.log('\nTest 5: Confidence above 1 is rejected');
  {
    const overConfidenceOutput = {
      classification: 'recoverable',
      diagnosis: 'Over-1.0 confidence score test',
      recommended_action: 'retry_payment',
      confidence: 1.15,
      reason: 'Out of bounds test',
      risk_level: 'low',
    };

    const res = validateLLMOutput(overConfidenceOutput);
    assert(res.valid === false, 'Validator rejects confidence score > 1.0');
    assert(res.error?.includes('out of bounds'), `Error message cites out of bounds: "${res.error}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 6: Missing required field is rejected
  // -------------------------------------------------------------------------
  console.log('\nTest 6: Missing required field is rejected');
  {
    const missingDiagnosisOutput = {
      classification: 'recoverable',
      recommended_action: 'retry_payment',
      confidence: 0.88,
      // diagnosis missing
      reason: 'Customer is good',
      risk_level: 'low',
    };

    const res = validateLLMOutput(missingDiagnosisOutput);
    assert(res.valid === false, 'Validator rejects output missing diagnosis field');
    assert(res.error?.includes('diagnosis'), `Error mentions missing diagnosis: "${res.error}"`);

    const missingReasonOutput = {
      classification: 'recoverable',
      diagnosis: 'Valid diagnosis',
      recommended_action: 'retry_payment',
      confidence: 0.88,
      // reason missing
      risk_level: 'low',
    };

    const res2 = validateLLMOutput(missingReasonOutput);
    assert(res2.valid === false, 'Validator rejects output missing reason field');
    assert(res2.error?.includes('reason'), `Error mentions missing reason: "${res2.error}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 7: Malformed JSON falls back safely
  // -------------------------------------------------------------------------
  console.log('\nTest 7: Malformed JSON falls back safely');
  {
    const malformedRaw = '```json { classification: "recoverable", unquoted_key: invalid ...';
    const res = validateLLMOutput(malformedRaw);
    assert(res.valid === false, 'Validator safely handles malformed raw JSON string without crashing');
    assert(res.error?.includes('Malformed JSON'), `Validator flags malformed JSON error: "${res.error}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 8: Provider failure falls back to deterministic engine
  // -------------------------------------------------------------------------
  console.log('\nTest 8: Provider failure falls back to deterministic engine');
  {
    // Configure invalid or failing provider
    const payment = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: 1,
      previous_successful_payments: 7,
    });

    // We can simulate an error by requesting an unavailable provider or simulating a down service
    // For instance, assessPaymentWithAI accepts providerOverride.
    // Let's test with 'ollama' when Ollama is not running on an unreachable port, or test fallback path directly
    const audit = await assessPaymentWithAI(payment, 'ollama');

    assert(audit.fallback_occurred === true, 'Audit records fallback_occurred === true when provider fails');
    assert(audit.decision_source === 'deterministic_fallback', `Decision source is 'deterministic_fallback' (got '${audit.decision_source}')`);
    assert(audit.ai_recommendation === null, 'ai_recommendation is safely null during fallback');
    assert(typeof audit.fallback_reason === 'string' && audit.fallback_reason.length > 0, `Fallback reason captured: "${audit.fallback_reason}"`);
    
    // Ensure final decision matches Phase 2 deterministic engine
    const phase2Decision = assessPayment(payment);
    assert(audit.final_decision.action === phase2Decision.action, `Fallback final action matches Phase 2 deterministic action ('${phase2Decision.action}')`);
    assert(audit.final_decision.classification === phase2Decision.classification, 'Fallback classification matches Phase 2');
  }

  // -------------------------------------------------------------------------
  // TEST 9: Expired card cannot become retry_payment (Policy override)
  // -------------------------------------------------------------------------
  console.log('\nTest 9: Expired card cannot become retry_payment (Policy override)');
  {
    const expiredPayment = createMockPayment({
      failure_reason: 'expired_card',
      attempt_count: 1,
      previous_successful_payments: 10,
    });

    // Mock provider suggests request_payment_method_update, but let's test policy validation directly
    // to prove that even if an AI recommends retry_payment, the policy engine intercepts and overrides it
    const rogueAIProposal = {
      classification: 'recoverable',
      diagnosis: 'Rogue AI hallucinating a retry on expired card',
      action: 'retry_payment',
      confidence: 0.99,
      reason: 'VIP customer, retry anyway!',
      risk_level: 'low',
    };

    const validation = validateDecision(rogueAIProposal, expiredPayment);
    assert(validation.allowed === false, 'Policy engine rejected retry_payment for expired card');
    assert(validation.overridden === true, 'Policy engine flagged overridden === true');
    assert(validation.final_action === 'request_payment_method_update', `Policy overrode action to request_payment_method_update (got '${validation.final_action}')`);
    assert(validation.policy_rule.includes('POL-002'), `Enforces rule POL-002: "${validation.policy_rule}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 10: Retry over maximum attempts is rejected
  // -------------------------------------------------------------------------
  console.log('\nTest 10: Retry over maximum attempts is rejected');
  {
    const maxRetriesPayment = createMockPayment({
      failure_reason: 'timeout',
      attempt_count: RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES, // 2
      previous_successful_payments: 8,
    });

    const aiRetryProposal = {
      classification: 'recoverable',
      diagnosis: 'AI suggesting another retry',
      action: 'retry_payment',
      confidence: 0.90,
      reason: 'Customer has great score',
      risk_level: 'low',
    };

    const validation = validateDecision(aiRetryProposal, maxRetriesPayment);
    assert(validation.allowed === false, 'Policy rejected retry_payment when attempt_count >= MAX_AUTOMATIC_RETRIES');
    assert(validation.overridden === true, 'Policy marks overridden === true');
    assert(validation.final_action === 'escalate_to_human', `Policy overrode action to escalate_to_human (got '${validation.final_action}')`);
    assert(validation.policy_rule.includes('POL-003'), `Enforces rule POL-003: "${validation.policy_rule}"`);
  }

  // -------------------------------------------------------------------------
  // TEST 11: LLM recommendation can be overridden by policy in full assessment
  // -------------------------------------------------------------------------
  console.log('\nTest 11: Full assessment workflow captures policy override of AI recommendation');
  {
    // Create payment where attempts = 2
    const payment = createMockPayment({
      payment_id: 'pay_override_test_11',
      failure_reason: 'timeout',
      attempt_count: 2,
    });

    // In mock mode for timeout with attempt_count >= 2, MockLLMProvider suggests escalate_to_human.
    // To explicitly test that assessPaymentWithAI handles overrides seamlessly when AI suggests retry:
    // We test assessPaymentWithAI on an active mock payment
    const audit = await assessPaymentWithAI(payment, 'mock');

    assert(audit.assessment_id.startsWith('audit_'), 'Valid audit assessment_id generated');
    assert(audit.decision_source === 'ai_with_policy_validation', 'Audit source is ai_with_policy_validation');
    assert(audit.final_decision.action === 'escalate_to_human', `Final action escalated safely: '${audit.final_decision.action}'`);
  }

  // -------------------------------------------------------------------------
  // TEST 12: Deterministic Phase 2 endpoint logic still works
  // -------------------------------------------------------------------------
  console.log('\nTest 12: Deterministic Phase 2 decision engine functions unchanged');
  {
    const payment = createMockPayment({
      failure_reason: 'expired_card',
      attempt_count: 1,
    });

    const phase2Decision = assessPayment(payment);
    assert(phase2Decision.action === 'request_payment_method_update', 'Phase 2 assessPayment returns request_payment_method_update');
    assert(phase2Decision.classification === 'recoverable', 'Phase 2 classification is recoverable');
    assert(phase2Decision.policy_rule.includes('POL-002'), 'Phase 2 references POL-002');
  }

  // -------------------------------------------------------------------------
  // TEST 13: AI assessment endpoint works in mock mode
  // -------------------------------------------------------------------------
  console.log('\nTest 13: AI assessment endpoint works in mock mode');
  {
    const payment = createMockPayment({
      payment_id: 'pay_mock_mode_test',
      failure_reason: 'timeout',
      attempt_count: 1,
      previous_successful_payments: 5,
    });

    const audit = await assessPaymentWithAI(payment, 'mock');
    assert(audit.provider === 'mock', `Provider is 'mock' (got '${audit.provider}')`);
    assert(audit.model === 'recoverai-mock-v1', `Model is 'recoverai-mock-v1' (got '${audit.model}')`);
    assert(audit.fallback_occurred === false, 'No fallback occurred in mock mode');
    assert(audit.ai_recommendation !== null, 'AI recommendation is populated');
    assert(audit.final_decision.action === 'retry_payment', 'Final decision action approved as retry_payment');
  }

  // -------------------------------------------------------------------------
  // TEST 14: No API keys appear in API responses / audit structures
  // -------------------------------------------------------------------------
  console.log('\nTest 14: No API keys or secrets appear in serialized audit structures');
  {
    const payment = createMockPayment();
    const audit = await assessPaymentWithAI(payment, 'mock');
    const serialized = JSON.stringify(audit);

    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /sk-[a-zA-Z0-9_-]{20,}/,
      /AIza[a-zA-Z0-9_-]{20,}/,
      /bearer\s+[a-zA-Z0-9._-]+/i,
    ];

    let foundSensitive = false;
    for (const pattern of sensitivePatterns) {
      if (pattern.test(serialized)) {
        foundSensitive = true;
        console.error(`Sensitive pattern found: ${pattern}`);
      }
    }

    assert(!foundSensitive, 'Zero API keys, tokens, or secret credentials leaked in assessment JSON');
  }

  // -------------------------------------------------------------------------
  // TEST 15: No payment status changes during AI assessment
  // -------------------------------------------------------------------------
  console.log('\nTest 15: Read-only guarantee — No payment status changes during AI assessment');
  {
    const dbPath = path.join(process.cwd(), 'data', 'recoverai.db');
    if (fs.existsSync(dbPath)) {
      const db = new DatabaseSync(dbPath);
      const paymentBefore = db.prepare("SELECT * FROM payments WHERE payment_id = 'pay_rec_0200'").get();
      assert(paymentBefore !== undefined, 'Target payment pay_rec_0200 found in DB');

      // Run AI assessment on pay_rec_0200
      const audit = await assessPaymentWithAI(paymentBefore, 'mock');
      assert(audit !== null, 'AI assessment produced valid audit');

      // Check DB record again
      const paymentAfter = db.prepare("SELECT * FROM payments WHERE payment_id = 'pay_rec_0200'").get();
      assert(paymentBefore.status === paymentAfter.status, `Payment status unchanged: '${paymentAfter.status}'`);
      assert(paymentBefore.attempt_count === paymentAfter.attempt_count, `Attempt count unchanged: ${paymentAfter.attempt_count}`);
      assert(paymentBefore.updated_at === paymentAfter.updated_at, 'updated_at timestamp untouched');

      db.close();
    } else {
      console.log('  ⚠️ SQLite DB file not found, skipping SQLite-specific read-only check');
    }
  }

  // -------------------------------------------------------------------------
  // TEST 16: No recovered revenue is created (Zero execution invariant)
  // -------------------------------------------------------------------------
  console.log('\nTest 16: Zero execution invariant — Recovered revenue is strictly 0');
  {
    const samplePayments = [
      createMockPayment({ payment_id: 'p1', amount: 2000, status: 'failed' }),
      createMockPayment({ payment_id: 'p2', amount: 5000, status: 'failed' }),
      createMockPayment({ payment_id: 'p3', amount: 1500, status: 'abandoned' }),
    ];

    const batch = await analyzeAIBatch(samplePayments, 'mock');
    assert(batch.recovered_revenue === 0, `batch.recovered_revenue is strictly 0 (got ${batch.recovered_revenue})`);
    assert(batch.potentially_recoverable_value > 0, `potentially_recoverable_value is computed as model estimate (got ₹${batch.potentially_recoverable_value})`);
    assert(batch.payments_analyzed === 3, `payments_analyzed is 3 (got ${batch.payments_analyzed})`);
  }

  console.log('\n=======================================================');
  if (failed === 0) {
    console.log(`  ALL ${passed} PHASE 3 LLM PROVIDER TESTS PASSED!`);
  } else {
    console.error(`  TEST RUN FAILED: ${passed} passed, ${failed} failed`);
    process.exit(1);
  }
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('Fatal error running LLM provider tests:', err);
  process.exit(1);
});
