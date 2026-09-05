import type { LLMProvider, PaymentContext, LLMRecommendation } from '../types.ts';

/**
 * DETERMINISTIC MOCK LLM PROVIDER
 *
 * Fully offline, reproducible mock reasoning engine.
 * Generates context-aware diagnostic recommendations without external APIs or network calls.
 * Enabled via: LLM_PROVIDER=mock (default)
 */
export class MockLLMProvider implements LLMProvider {
  readonly providerType = 'mock' as const;
  readonly modelName = 'recoverai-mock-v1';

  async analyzePayment(context: PaymentContext): Promise<LLMRecommendation> {
    const { payment, customer } = context;
    const failureReason = payment.failure_reason;
    const attempts = payment.attempt_count;

    // 1. Checkout Abandonment
    if (payment.status === 'abandoned' || failureReason === 'checkout_abandoned') {
      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Checkout session was abandoned prior to instrument completion.',
        recommended_action: 'contact_customer',
        confidence: 0.91,
        reason: `Commercial recovery opportunity detected for ${customer.customer_name}. Automated nudge recommended.`,
        risk_level: 'low',
      };
    }

    // 2. Expired Card
    if (failureReason === 'expired_card') {
      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Payment card instrument has passed its expiration date.',
        recommended_action: 'request_payment_method_update',
        confidence: 0.98,
        reason: 'Payment method is expired and non-actionable. Cardholder must provide an updated instrument.',
        risk_level: 'low',
      };
    }

    // 3. Transient Timeout
    if (failureReason === 'timeout') {
      if (attempts >= 2) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Mock LLM: Upstream gateway timed out across ${attempts} attempts. Infrastructure degradation suspected.`,
          recommended_action: 'escalate_to_human',
          confidence: 0.89,
          reason: `Repeated gateway timeouts exceeded standard recovery tolerance for ${customer.customer_name}. Manual operations review recommended.`,
          risk_level: 'medium',
        };
      }

      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Transient gateway network timeout during authorization handshake.',
        recommended_action: 'retry_payment',
        confidence: 0.93,
        reason: `Customer ${customer.customer_name} has high lifetime reliability (${customer.previous_successful_payments} past successes). Transient retry recommended.`,
        risk_level: 'low',
      };
    }

    // 4. Gateway 5xx Error
    if (failureReason === 'gateway_error') {
      if (attempts >= 2) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Mock LLM: Acquirer gateway returned persistent 5xx processing error across ${attempts} attempts.`,
          recommended_action: 'escalate_to_human',
          confidence: 0.91,
          reason: 'Multiple gateway 5xx errors encountered. Routing to engineering operations queue.',
          risk_level: 'high',
        };
      }

      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Upstream payment aggregator encountered intermittent processing degradation.',
        recommended_action: 'retry_payment',
        confidence: 0.87,
        reason: 'Temporary acquirer error appears transient. Recommended single bounded re-attempt.',
        risk_level: 'medium',
      };
    }

    // 5. Insufficient Funds
    if (failureReason === 'insufficient_funds') {
      if (attempts >= 2) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Mock LLM: Cardholder account balance remained insufficient after ${attempts} attempts.`,
          recommended_action: 'escalate_to_human',
          confidence: 0.86,
          reason: 'Balance exhaustion persists. Routing to customer success to avoid involuntary churn.',
          risk_level: 'medium',
        };
      }

      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Account balance or linked UPI mandate insufficient at time of debit.',
        recommended_action: 'contact_customer',
        confidence: 0.85,
        reason: `Avoid repeated card debits on depleted accounts. Recommending cardholder notification to top-up funds for ${customer.customer_name}.`,
        risk_level: 'medium',
      };
    }

    // 6. Authentication / OTP Failure
    if (failureReason === 'authentication_failure') {
      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Two-factor authentication (3DS / OTP) challenge was canceled or timed out.',
        recommended_action: 'contact_customer',
        confidence: 0.90,
        reason: 'Mandatory 2FA challenge requires cardholder authorization. Out-of-band communication recommended.',
        risk_level: 'medium',
      };
    }

    // 7. Bank Decline
    if (failureReason === 'bank_decline') {
      if (attempts >= 2 || (customer.previous_failed_payments > 2 && customer.previous_successful_payments === 0)) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Mock LLM: Issuing bank declined authorization across ${attempts} attempts.`,
          recommended_action: 'escalate_to_human',
          confidence: 0.88,
          reason: 'Persistent issuer decline indicates card block, suspicious activity hold, or limits. Escalate to operations.',
          risk_level: 'high',
        };
      }

      return {
        classification: 'recoverable',
        diagnosis: 'Mock LLM: Issuing bank refused transaction. Cardholder limit or mandate verification required.',
        recommended_action: 'contact_customer',
        confidence: 0.82,
        reason: `Cardholder ${customer.customer_name} should check with their issuing bank or approve transaction in mobile app.`,
        risk_level: 'medium',
      };
    }

    // Fallback default
    return {
      classification: 'requires_escalation',
      diagnosis: `Mock LLM: Unclassified failure state '${failureReason || 'unknown'}'.`,
      recommended_action: 'escalate_to_human',
      confidence: 0.75,
      reason: 'Unrecognized failure condition requires operator intervention.',
      risk_level: 'medium',
    };
  }
}
