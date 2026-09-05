import type { PaymentRecord } from '../../types.ts';
import type { RecoveryDecision } from '../../recovery/types.ts';
import type { RecoveryExecutionResult, RecoveryExecutor } from '../types.ts';
import type { AIAssessmentAudit } from '../../llm/types.ts';

/**
 * DETERMINISTIC MOCK RECOVERY EXECUTOR
 *
 * Simulates bounded recovery actions in a controlled test/demo environment.
 * Generates predictable, realistic outcomes based on transaction parameters,
 * customer track record, and failure characteristics.
 *
 * Invariant:
 * - Successful retries recover exact payment amount: amount_recovered = payment.amount
 * - Failed, blocked, customer action, or escalated attempts recover 0: amount_recovered = 0
 * - Zero real money movement or live gateway contact occurs.
 */
export class MockRecoveryExecutor implements RecoveryExecutor {
  readonly mode = 'mock' as const;

  async execute(
    payment: PaymentRecord,
    decision: RecoveryDecision,
    assessmentAudit?: AIAssessmentAudit | null
  ): Promise<RecoveryExecutionResult> {
    const timestamp = new Date().toISOString();
    const executionId = `rec_exec_${payment.payment_id}_${Date.now()}`;
    const assessmentId = assessmentAudit?.assessment_id || null;
    const provider = assessmentAudit?.provider || 'mock';
    const model = assessmentAudit?.model || 'recoverai-mock-v1';
    const decisionSource = assessmentAudit?.decision_source || 'deterministic_policy';

    const action = decision.action;
    const amountAttempted = payment.amount;

    // 1. RETRY PAYMENT ACTION
    if (action === 'retry_payment') {
      // Defense in depth: Executor stopping rules
      if (payment.attempt_count >= 2) {
        return {
          execution_id: executionId,
          payment_id: payment.payment_id,
          assessment_id: assessmentId,
          action: 'retry_payment',
          status: 'blocked',
          amount_attempted: amountAttempted,
          amount_recovered: 0,
          execution_mode: this.mode,
          failure_reason: 'Execution blocked by retry policy: Maximum automatic retries reached.',
          timestamp,
          policy_rule: decision.policy_rule,
          decision_source: decisionSource,
          provider,
          model,
        };
      }

      if (payment.failure_reason === 'expired_card') {
        return {
          execution_id: executionId,
          payment_id: payment.payment_id,
          assessment_id: assessmentId,
          action: 'retry_payment',
          status: 'blocked',
          amount_attempted: amountAttempted,
          amount_recovered: 0,
          execution_mode: this.mode,
          failure_reason: 'Execution blocked by policy: Expired cards must not be retried.',
          timestamp,
          policy_rule: decision.policy_rule,
          decision_source: decisionSource,
          provider,
          model,
        };
      }

      // Deterministic simulation rule:
      // Transient failures (timeout, gateway_error) with healthy customers on attempt 1 succeed
      const isTransient = payment.failure_reason === 'timeout' || payment.failure_reason === 'gateway_error';
      const isLowAttempts = payment.attempt_count <= 1;
      const hasStrongHistory =
        payment.previous_successful_payments >= 3 &&
        (payment.previous_failed_payments === 0 ||
          payment.previous_failed_payments / (payment.previous_successful_payments + payment.previous_failed_payments) < 0.25);

      if (isTransient && isLowAttempts && hasStrongHistory) {
        return {
          execution_id: executionId,
          payment_id: payment.payment_id,
          assessment_id: assessmentId,
          action: 'retry_payment',
          status: 'succeeded',
          amount_attempted: amountAttempted,
          amount_recovered: amountAttempted,
          execution_mode: this.mode,
          timestamp,
          policy_rule: decision.policy_rule,
          decision_source: decisionSource,
          provider,
          model,
        };
      }

      // Bank declines or transient with weaker history fail realistically in simulation
      return {
        execution_id: executionId,
        payment_id: payment.payment_id,
        assessment_id: assessmentId,
        action: 'retry_payment',
        status: 'failed',
        amount_attempted: amountAttempted,
        amount_recovered: 0,
        execution_mode: this.mode,
        failure_reason: isTransient
          ? 'Synthetic upstream gateway timeout: Secondary re-authorization attempt was rejected by aggregator.'
          : 'Synthetic bank rejection: Cardholder issuing bank declined secondary authorization attempt.',
        timestamp,
        policy_rule: decision.policy_rule,
        decision_source: decisionSource,
        provider,
        model,
      };
    }

    // 2. CONTACT CUSTOMER ACTION
    if (action === 'contact_customer') {
      return {
        execution_id: executionId,
        payment_id: payment.payment_id,
        assessment_id: assessmentId,
        action: 'contact_customer',
        status: 'customer_action_required',
        amount_attempted: amountAttempted,
        amount_recovered: 0,
        execution_mode: this.mode,
        failure_reason: 'Automated notification queued (WhatsApp / Email payment link dispatched to customer). Awaiting cardholder action.',
        timestamp,
        policy_rule: decision.policy_rule,
        decision_source: decisionSource,
        provider,
        model,
      };
    }

    // 3. REQUEST PAYMENT METHOD UPDATE ACTION
    if (action === 'request_payment_method_update') {
      return {
        execution_id: executionId,
        payment_id: payment.payment_id,
        assessment_id: assessmentId,
        action: 'request_payment_method_update',
        status: 'customer_action_required',
        amount_attempted: amountAttempted,
        amount_recovered: 0,
        execution_mode: this.mode,
        failure_reason: 'Payment method update link generated. Cardholder must input a valid, active payment instrument.',
        timestamp,
        policy_rule: decision.policy_rule,
        decision_source: decisionSource,
        provider,
        model,
      };
    }

    // 4. ESCALATE TO HUMAN ACTION
    if (action === 'escalate_to_human') {
      return {
        execution_id: executionId,
        payment_id: payment.payment_id,
        assessment_id: assessmentId,
        action: 'escalate_to_human',
        status: 'escalated',
        amount_attempted: amountAttempted,
        amount_recovered: 0,
        execution_mode: this.mode,
        failure_reason: 'Transaction routed to merchant operations support queue for manual risk inspection.',
        timestamp,
        policy_rule: decision.policy_rule,
        decision_source: decisionSource,
        provider,
        model,
      };
    }

    // 5. DO NOTHING ACTION
    return {
      execution_id: executionId,
      payment_id: payment.payment_id,
      assessment_id: assessmentId,
      action: 'do_nothing',
      status: 'no_action',
      amount_attempted: amountAttempted,
      amount_recovered: 0,
      execution_mode: this.mode,
      failure_reason: 'Terminal condition satisfied; no recovery execution required.',
      timestamp,
      policy_rule: decision.policy_rule,
      decision_source: decisionSource,
      provider,
      model,
    };
  }
}
