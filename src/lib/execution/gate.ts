import type { PaymentRecord } from '../types.ts';
import type { RecoveryDecision } from '../recovery/types.ts';
import type { ExecutionEligibility } from './types.ts';
import { RECOVERY_POLICY_CONFIG } from '../recovery/policy.ts';
import { getSuccessfulRecovery } from '../db.ts';

export interface ExecutionGateResult {
  eligible: boolean;
  eligibility: ExecutionEligibility;
  block_reason?: string;
}

/**
 * EXECUTION GATE (DEFENSE IN DEPTH)
 *
 * Verifies that a proposed recovery action is strictly eligible for execution
 * against policy boundaries and idempotency records BEFORE reaching any executor.
 */
export function verifyExecutionEligibility(
  payment: PaymentRecord,
  decision: RecoveryDecision
): ExecutionGateResult {
  // 1. IDEMPOTENCY CHECK: Has this payment already been successfully recovered?
  const existingSuccess = getSuccessfulRecovery(payment.payment_id);
  if (existingSuccess) {
    return {
      eligible: false,
      eligibility: 'already_recovered',
      block_reason: `Payment '${payment.payment_id}' has already been successfully recovered (₹${existingSuccess.amount_recovered.toLocaleString('en-IN')}) on ${existingSuccess.created_at}. Duplicate execution blocked.`,
    };
  }

  // 2. Terminal state guard
  if (payment.status === 'successful') {
    return {
      eligible: false,
      eligibility: 'blocked',
      block_reason: 'Payment is already finalized as successful. No execution permitted.',
    };
  }

  // 3. Expired Card Guard: Must NEVER be retried
  if (payment.failure_reason === 'expired_card' && decision.action === 'retry_payment') {
    return {
      eligible: false,
      eligibility: 'blocked',
      block_reason: 'Execution blocked by policy (POL-002): Expired payment cards cannot be retried. Customer instrument update required.',
    };
  }

  // 4. Max Retries Guard: Must not exceed MAX_AUTOMATIC_RETRIES (2)
  if (
    decision.action === 'retry_payment' &&
    payment.attempt_count >= RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES
  ) {
    return {
      eligible: false,
      eligibility: 'blocked',
      block_reason: `Execution blocked by retry policy (POL-003): Attempt count (${payment.attempt_count}) has reached the maximum permitted retries (${RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES}). Escalate to human.`,
    };
  }

  // 5. Bank Decline Restraint: Max 1 retry
  if (
    payment.failure_reason === 'bank_decline' &&
    decision.action === 'retry_payment' &&
    payment.attempt_count >= RECOVERY_POLICY_CONFIG.MAX_BANK_DECLINE_RETRIES
  ) {
    return {
      eligible: false,
      eligibility: 'blocked',
      block_reason: `Execution blocked by policy (POL-004): Bank decline re-attempt limit (${RECOVERY_POLICY_CONFIG.MAX_BANK_DECLINE_RETRIES}) reached. Escalate to human.`,
    };
  }

  // 6. Action type classification
  if (
    decision.action === 'contact_customer' ||
    decision.action === 'request_payment_method_update'
  ) {
    return {
      eligible: true,
      eligibility: 'customer_action_required',
    };
  }

  if (decision.action === 'escalate_to_human') {
    return {
      eligible: true,
      eligibility: 'blocked',
      block_reason: 'Escalated to human operator: Autonomous financial execution is paused awaiting manual operations review.',
    };
  }

  if (decision.action === 'do_nothing') {
    return {
      eligible: false,
      eligibility: 'blocked',
      block_reason: 'Policy mandates do_nothing: Payment does not require recovery action.',
    };
  }

  // Eligible retry_payment
  return {
    eligible: true,
    eligibility: 'eligible',
  };
}
