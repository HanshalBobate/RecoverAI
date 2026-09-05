import type { PaymentRecord } from '../types.ts';
import type { RecoveryDecision, RecoveryClassification } from './types.ts';
import { diagnosePayment } from './diagnosis.ts';
import { validateDecision } from './policy.ts';

/**
 * RECOVERY DECISION ENGINE (PHASE 2)
 *
 * Implements the deterministic multi-stage decision pipeline:
 * DETECT -> DIAGNOSE -> DECIDE -> POLICY VALIDATION -> FINAL DECISION
 *
 * GUARANTEES:
 * 1. Fully offline, 100% deterministic (no external LLM or network dependency).
 * 2. Zero payment execution: outputs analytical recommendations only.
 * 3. Strict safety boundary: Policy validator overrides any unsafe proposed action.
 * 4. Every recommendation contains an explicit stop condition and policy rule.
 * 5. Confidence is strictly bounded between 0.0 and 1.0.
 */
export function assessPayment(payment: PaymentRecord): RecoveryDecision {
  // STAGE 1 & 2: DIAGNOSE & DECIDE (Proposed Action)
  const proposed = diagnosePayment(payment);

  // STAGE 3: POLICY VALIDATION (Safety Boundary)
  const validation = validateDecision(proposed, payment);

  // Determine final classification if policy modified the intent
  let finalClassification: RecoveryClassification = proposed.classification;
  if (validation.overridden) {
    if (validation.final_action === 'escalate_to_human') {
      finalClassification = 'requires_escalation';
    } else if (validation.final_action === 'do_nothing') {
      finalClassification = 'unlikely_recoverable';
    }
  }

  // Ensure confidence is strictly clamped between 0 and 1
  const boundedConfidence = Math.min(1.0, Math.max(0.0, Math.round(proposed.confidence * 100) / 100));

  const finalDecision: RecoveryDecision = {
    payment_id: payment.payment_id,
    classification: finalClassification,
    diagnosis: proposed.diagnosis,
    action: validation.final_action,
    confidence: boundedConfidence,
    reason: validation.overridden ? validation.reason : proposed.reason,
    policy_rule: validation.policy_rule,
    stop_condition: validation.stop_condition,
    risk_level: proposed.risk_level,
    policy_overridden: validation.overridden,
    original_action: validation.overridden ? proposed.action : undefined,
  };

  return finalDecision;
}
