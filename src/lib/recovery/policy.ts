import type { PaymentRecord } from '../types.ts';
import type { ProposedDecision, PolicyValidationResult, RecoveryAction } from './types.ts';

/**
 * RECOVERY POLICY CONFIGURATION
 * Centralized governance thresholds controlling autonomous recovery safety boundaries.
 */
export const RECOVERY_POLICY_CONFIG = {
  /** Maximum number of automatic retries permitted across any transient payment failure */
  MAX_AUTOMATIC_RETRIES: 2,

  /** Maximum retry attempts specifically for bank declines (even for high-reputation customers) */
  MAX_BANK_DECLINE_RETRIES: 1,

  /** High-value transaction threshold in INR (₹50,000) requiring mandatory human escalation if risky */
  HIGH_VALUE_THRESHOLD: 50000,

  /** Minimum lifetime successful transactions to qualify a customer as "healthy/strong history" */
  STRONG_HISTORY_MIN_SUCCESSES: 3,

  /** Maximum failure-to-success ratio before customer history is deemed "poor/weak" */
  POOR_HISTORY_FAILURE_RATIO_THRESHOLD: 0.5,
} as const;

/**
 * Validates a proposed recovery decision against deterministic safety boundaries.
 *
 * CRITICAL DESIGN PRINCIPLE:
 * The Policy Engine has supreme override authority over proposed actions.
 * If an action violates any policy rule (e.g. attempt limit exceeded, retrying an expired card),
 * the policy engine rejects the action and forces a compliant safe action (e.g. escalate_to_human, request_payment_method_update).
 */
export function validateDecision(
  proposed: ProposedDecision,
  payment: PaymentRecord
): PolicyValidationResult {
  const { MAX_AUTOMATIC_RETRIES, MAX_BANK_DECLINE_RETRIES, HIGH_VALUE_THRESHOLD } = RECOVERY_POLICY_CONFIG;

  // RULE 1: Already successful or pending payments must never have active interventions
  if (payment.status === 'successful') {
    return {
      allowed: proposed.action === 'do_nothing',
      final_action: 'do_nothing',
      policy_rule: 'POL-000: Payment is already finalized as successful.',
      stop_condition: 'Terminal state achieved; no recovery intervention required.',
      reason: 'Payment has already succeeded. No intervention is permitted.',
      overridden: proposed.action !== 'do_nothing',
    };
  }

  if (payment.status === 'pending') {
    return {
      allowed: proposed.action === 'do_nothing',
      final_action: 'do_nothing',
      policy_rule: 'POL-001: Payment is actively pending settlement.',
      stop_condition: 'Wait for gateway webhook confirmation before initiating recovery.',
      reason: 'Transaction is in pending state. Interventions are held until terminal status is reached.',
      overridden: proposed.action !== 'do_nothing',
    };
  }

  // RULE 2: Expired payment methods must NEVER be retried
  if (payment.failure_reason === 'expired_card') {
    if (proposed.action === 'retry_payment') {
      return {
        allowed: false,
        final_action: 'request_payment_method_update',
        policy_rule: 'POL-002: Hard Stop — Expired payment instruments must never be submitted for retry.',
        stop_condition: 'Do not retry expired payment methods. Await cardholder instrument update.',
        reason: 'Policy override: Payment instrument has expired. Automatic retry rejected; requesting payment method update instead.',
        overridden: true,
      };
    }
    return {
      allowed: true,
      final_action: proposed.action,
      policy_rule: 'POL-002: Expired payment method requires instrument update.',
      stop_condition: 'Do not retry expired payment methods. Await customer instrument update.',
      reason: proposed.reason,
      overridden: false,
    };
  }

  // RULE 3: Maximum Retry Bound across all transient failures
  if (proposed.action === 'retry_payment' && payment.attempt_count >= MAX_AUTOMATIC_RETRIES) {
    const isHighValue = payment.amount >= HIGH_VALUE_THRESHOLD;
    const finalAction: RecoveryAction = isHighValue ? 'escalate_to_human' : 'escalate_to_human';

    return {
      allowed: false,
      final_action: finalAction,
      policy_rule: `POL-003: Retry Cap Enforced — Automatic retries capped at ${MAX_AUTOMATIC_RETRIES} attempts.`,
      stop_condition: `Stop automatic retries after ${MAX_AUTOMATIC_RETRIES} attempts. Escalate to operations team.`,
      reason: `Policy override: Attempt count (${payment.attempt_count}) has reached the maximum permitted automatic retries (${MAX_AUTOMATIC_RETRIES}). Overriding retry to escalate_to_human.`,
      overridden: true,
    };
  }

  // RULE 4: Bank decline retry constraints
  if (payment.failure_reason === 'bank_decline') {
    if (proposed.action === 'retry_payment' && payment.attempt_count >= MAX_BANK_DECLINE_RETRIES) {
      return {
        allowed: false,
        final_action: 'escalate_to_human',
        policy_rule: `POL-004: Bank Decline Safeguard — Bank declines capped at ${MAX_BANK_DECLINE_RETRIES} retry attempt.`,
        stop_condition: 'Escalate after repeated bank declines. Do not spam issuing bank.',
        reason: `Policy override: Bank decline retry threshold (${MAX_BANK_DECLINE_RETRIES}) reached. Repeated attempts risk fraud scoring; escalating to human.`,
        overridden: true,
      };
    }
  }

  // RULE 5: Authentication failures must not be retried automatically without customer involvement
  if (payment.failure_reason === 'authentication_failure') {
    if (proposed.action === 'retry_payment') {
      return {
        allowed: false,
        final_action: 'contact_customer',
        policy_rule: 'POL-005: 3DS/Auth Safeguard — Authentication failures require explicit customer authorization.',
        stop_condition: 'Do not automatically retry authentication failures indefinitely. Customer intervention required.',
        reason: 'Policy override: Automated retry rejected for 3DS authentication failure. Customer must be contacted to complete authorization.',
        overridden: true,
      };
    }
  }

  // RULE 6: Canceled / Unpaid subscriptions require human review or passive customer notice
  if (payment.subscription_status === 'canceled' && proposed.action === 'retry_payment') {
    return {
      allowed: false,
      final_action: 'escalate_to_human',
      policy_rule: 'POL-006: Subscription Guard — Canceled subscriptions cannot be automatically retried.',
      stop_condition: 'Subscription canceled; cease autonomous recovery attempts.',
      reason: 'Policy override: Merchant policy prohibits autonomous billing retries on canceled subscriptions.',
      overridden: true,
    };
  }

  // RULE 7: High-Value Risk Boundary
  if (payment.amount >= HIGH_VALUE_THRESHOLD && payment.attempt_count > 1 && proposed.action === 'retry_payment') {
    return {
      allowed: false,
      final_action: 'escalate_to_human',
      policy_rule: `POL-007: High-Value Exposure Guard — Transactions >= ₹${HIGH_VALUE_THRESHOLD.toLocaleString('en-IN')} with repeated attempts require human review.`,
      stop_condition: 'High-value transaction threshold exceeded; require supervisor clearance.',
      reason: `Policy override: High value payment (₹${payment.amount.toLocaleString('en-IN')}) with multiple attempts requires human supervisor clearance.`,
      overridden: true,
    };
  }

  // Default: Proposed decision complies with all policy rules
  let defaultStopCondition = 'Stop after 1 execution cycle unless status update occurs.';
  if (proposed.action === 'retry_payment') {
    defaultStopCondition = `Stop automatic retries after ${MAX_AUTOMATIC_RETRIES} attempts.`;
  } else if (proposed.action === 'contact_customer') {
    defaultStopCondition = 'Stop outreach after 3 unanswered notifications or upon customer response.';
  } else if (proposed.action === 'request_payment_method_update') {
    defaultStopCondition = 'Expire update request link after 72 hours. Customer intervention required.';
  } else if (proposed.action === 'escalate_to_human') {
    defaultStopCondition = 'Escalated to human operator; autonomous agent pauses actions.';
  } else if (proposed.action === 'do_nothing') {
    defaultStopCondition = 'No action permitted; terminal policy hold.';
  }

  return {
    allowed: true,
    final_action: proposed.action,
    policy_rule: 'POL-100: Standard Autonomous Recovery Policy Permitted.',
    stop_condition: defaultStopCondition,
    reason: proposed.reason,
    overridden: false,
  };
}
