import type { PaymentRecord } from '../types.ts';
import type { ProposedDecision, RecoveryClassification, RecoveryAction, RiskLevel } from './types.ts';
import { RECOVERY_POLICY_CONFIG } from './policy.ts';

export interface CustomerHistoryEvaluation {
  totalHistorical: number;
  successRate: number | null; // 0 to 1
  isStrong: boolean;
  isWeak: boolean;
  isNewCustomer: boolean;
  historySummary: string;
}

/**
 * Evaluates customer historical payment behavior deterministically.
 */
export function evaluateCustomerHistory(payment: PaymentRecord): CustomerHistoryEvaluation {
  const successes = payment.previous_successful_payments;
  const failures = payment.previous_failed_payments;
  const total = successes + failures;

  if (total === 0) {
    return {
      totalHistorical: 0,
      successRate: null,
      isStrong: false,
      isWeak: false,
      isNewCustomer: true,
      historySummary: 'First-time customer with zero previous transaction history recorded.',
    };
  }

  const successRate = Math.round((successes / total) * 100) / 100;
  const isStrong = successes >= RECOVERY_POLICY_CONFIG.STRONG_HISTORY_MIN_SUCCESSES && successRate >= 0.7;
  const isWeak = failures >= 2 && successRate < RECOVERY_POLICY_CONFIG.POOR_HISTORY_FAILURE_RATIO_THRESHOLD;

  let historySummary = '';
  if (isStrong) {
    historySummary = `High-reputation customer with strong historical track record (${successes} successful payments, ${Math.round(successRate * 100)}% success rate).`;
  } else if (isWeak) {
    historySummary = `Elevated risk customer with poor historical track record (${failures} past failures vs ${successes} successes, ${Math.round(successRate * 100)}% success rate).`;
  } else {
    historySummary = `Moderate historical track record (${successes} successful vs ${failures} failed payments).`;
  }

  return {
    totalHistorical: total,
    successRate,
    isStrong,
    isWeak,
    isNewCustomer: false,
    historySummary,
  };
}

/**
 * Generates a deterministic proposed diagnosis and recommended recovery action.
 *
 * Separation of Concerns:
 * This layer answers "What is probably happening?" and "What would be a sensible intervention?"
 * It produces a ProposedDecision which MUST subsequently pass through the Policy Validation layer.
 */
export function diagnosePayment(payment: PaymentRecord): ProposedDecision {
  const history = evaluateCustomerHistory(payment);
  const maxRetries = RECOVERY_POLICY_CONFIG.MAX_AUTOMATIC_RETRIES;
  const attempts = payment.attempt_count;

  // Handle successful status
  if (payment.status === 'successful') {
    return {
      classification: 'unlikely_recoverable',
      diagnosis: 'Transaction has already settled successfully.',
      action: 'do_nothing',
      confidence: 1.0,
      reason: 'No recovery intervention required; funds are already secured.',
      risk_level: 'low',
    };
  }

  // Handle pending status
  if (payment.status === 'pending') {
    return {
      classification: 'unlikely_recoverable',
      diagnosis: 'Payment processing in-flight. Awaiting gateway settlement callback.',
      action: 'do_nothing',
      confidence: 0.95,
      reason: 'Transaction is actively in-flight. Premature interventions could cause duplicate billing.',
      risk_level: 'low',
    };
  }

  // Check checkout abandonment
  if (payment.status === 'abandoned' || payment.failure_reason === 'checkout_abandoned') {
    let confidence = 0.82;
    if (history.isStrong) confidence = 0.92;
    if (history.isWeak) confidence = 0.72;

    return {
      classification: 'recoverable',
      diagnosis: 'Customer initiated checkout session but dropped off before completing payment instrument entry.',
      action: 'contact_customer',
      confidence,
      reason: `Commercial dropoff detected rather than a technical failure. Initiating automated recovery nudge. ${history.historySummary}`,
      risk_level: 'low',
    };
  }

  // Categorized Technical Failures
  switch (payment.failure_reason) {
    // 1. TIMEOUT
    case 'timeout': {
      if (attempts >= maxRetries) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Gateway timed out after ${attempts} attempts. Infrastructure latency or intermittent provider failure persists.`,
          action: 'escalate_to_human',
          confidence: 0.88,
          reason: `Repeated gateway timeouts exhausted automatic retry limit (${maxRetries}). Manual operations review required. ${history.historySummary}`,
          risk_level: 'medium',
        };
      }

      let confidence = 0.90;
      let risk: RiskLevel = 'low';
      if (history.isStrong) {
        confidence = 0.95;
      } else if (history.isWeak) {
        confidence = 0.78;
        risk = 'medium';
      }

      return {
        classification: 'recoverable',
        diagnosis: 'Transient gateway or network timeout during authorization handshake.',
        action: 'retry_payment',
        confidence,
        reason: `Failure is transient. Customer has ${attempts} of ${maxRetries} allowed attempts remaining. ${history.historySummary}`,
        risk_level: risk,
      };
    }

    // 2. GATEWAY ERROR
    case 'gateway_error': {
      if (attempts >= maxRetries) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Upstream payment aggregator returned persistent 5xx processing errors across ${attempts} attempts.`,
          action: 'escalate_to_human',
          confidence: 0.92,
          reason: `Repeated gateway errors reached max attempt boundary (${maxRetries}). Escalate to technical operations to inspect provider health. ${history.historySummary}`,
          risk_level: 'high',
        };
      }

      let confidence = 0.86;
      let risk: RiskLevel = 'low';
      if (history.isStrong) {
        confidence = 0.92;
      } else if (history.isWeak) {
        confidence = 0.75;
        risk = 'medium';
      }

      return {
        classification: 'recoverable',
        diagnosis: 'Transient 5xx error or upstream interchange degradation from payment gateway.',
        action: 'retry_payment',
        confidence,
        reason: `Gateway error appears intermittent. Safe to perform bounded automatic retry. ${history.historySummary}`,
        risk_level: risk,
      };
    }

    // 3. BANK DECLINE
    case 'bank_decline': {
      // Do NOT blindly retry bank declines.
      // Only permit limited retry if attempt count is 1 AND customer has strong history
      if (attempts === 1 && history.isStrong) {
        return {
          classification: 'recoverable',
          diagnosis: 'Card issuer or bank declined transaction. Customer has strong lifetime repayment record.',
          action: 'retry_payment',
          confidence: 0.78,
          reason: `Customer history demonstrates strong creditworthiness (${history.totalHistorical} past payments with high success rate). Single conservative retry permitted. ${history.historySummary}`,
          risk_level: 'medium',
        };
      }

      if (attempts >= 2 || history.isWeak) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Persistent bank decline recorded after ${attempts} attempts or elevated customer risk profile.`,
          action: 'escalate_to_human',
          confidence: 0.89,
          reason: `Repeated bank declines or weak customer history indicates issuer block or insufficient limits. Autonomous retry aborted. ${history.historySummary}`,
          risk_level: 'high',
        };
      }

      // Default for bank decline with moderate/new history: contact customer to check with bank
      return {
        classification: 'recoverable',
        diagnosis: 'Issuing bank refused authorization. Likely daily card limit or security hold.',
        action: 'contact_customer',
        confidence: 0.80,
        reason: `Customer must contact issuing bank to authorize charge or approve recurring mandate. ${history.historySummary}`,
        risk_level: 'medium',
      };
    }

    // 4. INSUFFICIENT FUNDS
    case 'insufficient_funds': {
      if (attempts >= maxRetries) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Insufficient balance persisted across ${attempts} retry attempts.`,
          action: 'escalate_to_human',
          confidence: 0.88,
          reason: `Repeated insufficient fund notices after ${attempts} attempts. Escalating to account management to avoid churn. ${history.historySummary}`,
          risk_level: 'medium',
        };
      }

      let confidence = 0.84;
      if (history.isStrong) confidence = 0.90;
      if (history.isWeak) confidence = 0.72;

      return {
        classification: 'recoverable',
        diagnosis: 'Account balance or UPI linked account had insufficient funds at transaction execution.',
        action: 'contact_customer',
        confidence,
        reason: `Do not aggressively retry depleted accounts. Recommending customer notification to allow account top-up. ${history.historySummary}`,
        risk_level: 'medium',
      };
    }

    // 5. EXPIRED CARD
    case 'expired_card': {
      return {
        classification: 'recoverable',
        diagnosis: 'Card expiration date has passed. Instrument is permanently unusable for future debits.',
        action: 'request_payment_method_update',
        confidence: 0.98,
        reason: `Card instrument expired. Retrying payment is mathematically guaranteed to fail. Requesting new payment method link. ${history.historySummary}`,
        risk_level: 'low',
      };
    }

    // 6. AUTHENTICATION FAILURE
    case 'authentication_failure': {
      if (attempts >= maxRetries) {
        return {
          classification: 'requires_escalation',
          diagnosis: `Customer failed 3DS / OTP verification across ${attempts} attempts. Potential cardholder confusion or friction.`,
          action: 'escalate_to_human',
          confidence: 0.87,
          reason: `Authentication verification failed repeatedly. Manual customer success escalation required. ${history.historySummary}`,
          risk_level: 'high',
        };
      }

      let confidence = 0.85;
      if (history.isStrong) confidence = 0.91;

      return {
        classification: 'recoverable',
        diagnosis: 'Two-factor authentication (3D Secure / OTP) challenge was canceled or timed out.',
        action: 'contact_customer',
        confidence,
        reason: `Requires customer intervention to complete SMS OTP verification or approve banking app notification. Automatic retries cannot bypass 3DS. ${history.historySummary}`,
        risk_level: 'medium',
      };
    }

    default: {
      return {
        classification: 'requires_escalation',
        diagnosis: `Unclassified payment failure reason: '${payment.failure_reason || 'unknown'}'.`,
        action: 'escalate_to_human',
        confidence: 0.70,
        reason: `Unrecognized failure mechanism requires operational triage. ${history.historySummary}`,
        risk_level: 'medium',
      };
    }
  }
}
