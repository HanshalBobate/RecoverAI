import type { PaymentRecord } from '../types.ts';
import type { PaymentContext } from './types.ts';
import { evaluateCustomerHistory } from '../recovery/diagnosis.ts';
import { RECOVERY_POLICY_CONFIG } from '../recovery/policy.ts';

/**
 * Builds a structured, minimal context object for LLM consumption.
 * Security Note: Strictly filters out database metadata, environment secrets, and unrelated fields.
 */
export function buildPaymentContext(payment: PaymentRecord): PaymentContext {
  const history = evaluateCustomerHistory(payment);

  return {
    payment: {
      payment_id: payment.payment_id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      failure_reason: payment.failure_reason,
      attempt_count: payment.attempt_count,
      created_at: payment.created_at,
      last_attempt_at: payment.last_attempt_at,
      payment_method_type: payment.payment_method_type,
      payment_method_detail: payment.payment_method_detail,
    },
    customer: {
      customer_id: payment.customer_id,
      customer_name: payment.customer_name,
      customer_email: payment.customer_email,
      subscription_status: payment.subscription_status,
      previous_successful_payments: payment.previous_successful_payments,
      previous_failed_payments: payment.previous_failed_payments,
      total_history: history.totalHistorical,
      success_rate: history.successRate,
      reputation: history.historySummary,
    },
    policy_constraints: {
      max_automatic_retries: RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES,
      max_bank_decline_retries: RECOVERY_POLICY_CONFIG.MAX_BANK_DECLINE_RETRIES,
      high_value_threshold: RECOVERY_POLICY_CONFIG.HIGH_VALUE_THRESHOLD,
      stopping_rule_guidance:
        'Every action must respect retry caps (max 2), avoid retrying expired instruments, and require human escalation for chronic failures.',
    },
  };
}

/**
 * System prompt instructing the LLM to act as the RecoverAI diagnostic agent
 * and enforce strict JSON schema conformance.
 */
export function buildSystemPrompt(): string {
  return `You are RecoverAI Brain, an expert AI revenue recovery diagnostic agent for Indian merchant payments.
Your role is to diagnose the root cause of payment failures or checkout dropoffs and recommend an appropriate recovery intervention.

CRITICAL INSTRUCTIONS:
1. You can recommend an intervention, but you cannot execute it. Your recommendation will be validated by a deterministic safety policy.
2. Allowed classifications:
   - "recoverable" (intervention is likely to succeed)
   - "unlikely_recoverable" (unrecoverable or terminal state)
   - "requires_escalation" (requires human supervisor or operations review)
3. Allowed actions (choose exactly ONE):
   - "retry_payment" (only for transient timeouts or temporary gateway errors below attempt limits)
   - "contact_customer" (for insufficient funds, 3DS authentication/OTP failures, or abandoned checkout)
   - "request_payment_method_update" (for expired cards or invalid payment instruments; NEVER retry expired cards)
   - "escalate_to_human" (for repeated bank declines, chronic failures, or high-value risk)
   - "do_nothing" (for terminal or in-flight payments)
4. Allowed risk levels: "low", "medium", "high"
5. Confidence must be a number between 0.0 and 1.0 (e.g. 0.85).
6. Return ONLY a valid, single JSON object with no preamble, markdown code fences, or surrounding text.

JSON Schema:
{
  "classification": "recoverable" | "unlikely_recoverable" | "requires_escalation",
  "diagnosis": "concise description of what happened",
  "recommended_action": "retry_payment" | "contact_customer" | "request_payment_method_update" | "escalate_to_human" | "do_nothing",
  "confidence": float between 0.0 and 1.0,
  "reason": "explanation of why intervention is appropriate, citing customer history and failure type",
  "risk_level": "low" | "medium" | "high"
}`;
}

/**
 * Serializes the payment context into a clean prompt string for the LLM.
 */
export function buildUserPrompt(context: PaymentContext): string {
  return `Analyze this at-risk payment transaction and provide your diagnostic recommendation in the required JSON format:

${JSON.stringify(context, null, 2)}`;
}
