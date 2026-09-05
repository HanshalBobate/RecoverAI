import type { PaymentRecord } from '../types.ts';
import type { RecoveryDecision, BatchRecoveryMetrics } from './types.ts';
import { assessPayment } from './engine.ts';

export interface BatchAnalysisResult {
  metrics: BatchRecoveryMetrics;
  decisions: RecoveryDecision[];
}

/**
 * Executes the deterministic Recovery Decision Engine across a batch of payment records.
 * Aggregates operational telemetry and estimates revenue at risk.
 *
 * NOTE ON FINANCIAL REPORTING:
 * `potentially_recoverable_value` is an algorithmic model estimate of salvageable volume.
 * It is NOT recovered revenue; no execution or settlement has occurred.
 */
export function analyzeBatch(payments: PaymentRecord[]): BatchAnalysisResult {
  let recoverable_count = 0;
  let unlikely_recoverable_count = 0;
  let escalation_count = 0;

  let retry_recommendation_count = 0;
  let customer_contact_count = 0;
  let payment_method_update_count = 0;
  let do_nothing_count = 0;

  let total_revenue_at_risk = 0;
  let potentially_recoverable_value = 0;

  const decisions: RecoveryDecision[] = [];

  for (const payment of payments) {
    const decision = assessPayment(payment);
    decisions.push(decision);

    // Track at-risk transaction volume
    if (payment.status === 'failed' || payment.status === 'abandoned') {
      total_revenue_at_risk += payment.amount;
    }

    // Tally classifications
    if (decision.classification === 'recoverable') {
      recoverable_count++;
      // Recoverable value is estimated for actionable recovery classifications
      potentially_recoverable_value += payment.amount;
    } else if (decision.classification === 'requires_escalation') {
      escalation_count++;
    } else {
      unlikely_recoverable_count++;
    }

    // Tally recommended actions
    switch (decision.action) {
      case 'retry_payment':
        retry_recommendation_count++;
        break;
      case 'contact_customer':
        customer_contact_count++;
        break;
      case 'request_payment_method_update':
        payment_method_update_count++;
        break;
      case 'escalate_to_human':
        // If final action is escalation, ensure escalation tally consistency
        break;
      case 'do_nothing':
        do_nothing_count++;
        break;
    }
  }

  // Count of escalate_to_human actions specifically
  const escalateActionCount = decisions.filter(d => d.action === 'escalate_to_human').length;

  const metrics: BatchRecoveryMetrics = {
    payments_analyzed: payments.length,
    recoverable_count,
    unlikely_recoverable_count,
    escalation_count: escalateActionCount,
    retry_recommendation_count,
    customer_contact_count,
    payment_method_update_count,
    do_nothing_count,
    total_revenue_at_risk: Math.round(total_revenue_at_risk * 100) / 100,
    potentially_recoverable_value: Math.round(potentially_recoverable_value * 100) / 100,
  };

  return { metrics, decisions };
}
