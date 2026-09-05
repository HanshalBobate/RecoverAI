import type { PaymentRecord } from '../types.ts';
import type {
  LLMProvider,
  LLMProviderType,
  AIAssessmentAudit,
  BatchAIAssessmentResult,
} from './types.ts';
import type { ProposedDecision, RecoveryAction, RecoveryClassification, RecoveryDecision } from '../recovery/types.ts';
import { buildPaymentContext } from './context.ts';
import { MockLLMProvider } from './providers/mock.ts';
import { OllamaLLMProvider } from './providers/ollama.ts';
import { OpenAILLMProvider } from './providers/openai.ts';
import { GeminiLLMProvider } from './providers/gemini.ts';
import { assessPayment } from '../recovery/engine.ts';
import { validateDecision } from '../recovery/policy.ts';

/**
 * Returns active LLM provider based on environment configuration or optional override.
 * Defaults to 'mock' if unspecified or invalid, guaranteeing 100% offline reliability.
 */
export function getLLMProvider(overrideType?: LLMProviderType): LLMProvider {
  const providerType = (overrideType || process.env.LLM_PROVIDER || 'mock').toLowerCase().trim() as LLMProviderType;

  switch (providerType) {
    case 'ollama':
      return new OllamaLLMProvider();
    case 'openai':
      return new OpenAILLMProvider();
    case 'gemini':
      return new GeminiLLMProvider();
    case 'mock':
    default:
      return new MockLLMProvider();
  }
}

/**
 * Executes the complete AI Assessment & Policy Validation pipeline for a single payment.
 *
 * PIPELINE FLOW:
 * 1. Build structured PaymentContext.
 * 2. Invoke configured LLM Provider.
 * 3. Validate raw output against strict schema.
 * 4. IF error occurs: seamlessly fall back to Phase 2 Deterministic Assessment.
 * 5. IF successful: pass proposed decision to Phase 2 Policy Engine.
 * 6. The Policy Engine has supreme authority to approve or OVERRIDE the AI action.
 * 7. Return complete audit representation with both AI suggestion and final decision.
 *
 * GUARANTEE: Zero payment execution is performed.
 */
export async function assessPaymentWithAI(
  payment: PaymentRecord,
  providerOverride?: LLMProviderType
): Promise<AIAssessmentAudit> {
  const provider = getLLMProvider(providerOverride);
  const context = buildPaymentContext(payment);
  const assessmentId = `audit_${payment.payment_id}_${Date.now()}`;
  const timestamp = new Date().toISOString();

  try {
    // 1. Invoke LLM Provider
    const recommendation = await provider.analyzePayment(context);

    // 2. Formulate Proposed Decision
    const proposed: ProposedDecision = {
      classification: recommendation.classification,
      diagnosis: recommendation.diagnosis,
      action: recommendation.recommended_action,
      confidence: recommendation.confidence,
      reason: recommendation.reason,
      risk_level: recommendation.risk_level,
    };

    // 3. POLICY VALIDATION: The policy engine validates or overrides the AI proposal
    const validation = validateDecision(proposed, payment);

    // 4. Formulate Final Decision
    let finalClassification: RecoveryClassification = proposed.classification;
    if (validation.overridden) {
      if (validation.final_action === 'escalate_to_human') {
        finalClassification = 'requires_escalation';
      } else if (validation.final_action === 'do_nothing') {
        finalClassification = 'unlikely_recoverable';
      }
    }

    const finalDecision: RecoveryDecision = {
      payment_id: payment.payment_id,
      classification: finalClassification,
      diagnosis: proposed.diagnosis,
      action: validation.final_action,
      confidence: Math.min(1.0, Math.max(0.0, proposed.confidence)),
      reason: validation.overridden
        ? `[Policy Guard Intercepted AI] ${validation.reason}`
        : proposed.reason,
      policy_rule: validation.policy_rule,
      stop_condition: validation.stop_condition,
      risk_level: proposed.risk_level,
      policy_overridden: validation.overridden,
      original_action: validation.overridden ? proposed.action : undefined,
    };

    return {
      assessment_id: assessmentId,
      timestamp,
      payment_id: payment.payment_id,
      provider: provider.providerType,
      model: provider.modelName,
      ai_recommendation: recommendation,
      policy_result: validation,
      final_decision: finalDecision,
      decision_source: 'ai_with_policy_validation',
      fallback_occurred: false,
      policy_overridden: validation.overridden,
    };
  } catch (error: unknown) {
    // 4. DETERMINISTIC FALLBACK: If LLM fails, network drops, or JSON is invalid
    const fallbackReason = error instanceof Error ? error.message : 'Unknown provider error';
    const fallbackDecision = assessPayment(payment);

    return {
      assessment_id: assessmentId,
      timestamp,
      payment_id: payment.payment_id,
      provider: provider.providerType,
      model: provider.modelName,
      ai_recommendation: null,
      policy_result: {
        allowed: true,
        final_action: fallbackDecision.action,
        policy_rule: fallbackDecision.policy_rule,
        stop_condition: fallbackDecision.stop_condition,
        reason: 'Fallback to deterministic rules engine.',
        overridden: fallbackDecision.policy_overridden,
      },
      final_decision: fallbackDecision,
      decision_source: 'deterministic_fallback',
      fallback_occurred: true,
      fallback_reason: fallbackReason,
      policy_overridden: fallbackDecision.policy_overridden,
    };
  }
}

/**
 * Runs batch AI assessment across a list of at-risk payment transactions.
 * Aggregates AI vs Policy telemetry, override frequencies, and potential value.
 */
export async function analyzeAIBatch(
  payments: PaymentRecord[],
  providerOverride?: LLMProviderType
): Promise<BatchAIAssessmentResult> {
  const provider = getLLMProvider(providerOverride);
  const assessments: AIAssessmentAudit[] = [];

  let ai_recommendations_count = 0;
  let policy_overrides_count = 0;
  let fallbacks_count = 0;
  let total_revenue_at_risk = 0;
  let potentially_recoverable_value = 0;

  const action_distribution: Record<RecoveryAction, number> = {
    retry_payment: 0,
    contact_customer: 0,
    request_payment_method_update: 0,
    escalate_to_human: 0,
    do_nothing: 0,
  };

  for (const payment of payments) {
    const audit = await assessPaymentWithAI(payment, providerOverride);
    assessments.push(audit);

    if (payment.status === 'failed' || payment.status === 'abandoned') {
      total_revenue_at_risk += payment.amount;
    }

    if (audit.fallback_occurred) {
      fallbacks_count++;
    } else {
      ai_recommendations_count++;
    }

    if (audit.policy_overridden) {
      policy_overrides_count++;
    }

    const action = audit.final_decision.action;
    action_distribution[action] = (action_distribution[action] || 0) + 1;

    if (audit.final_decision.classification === 'recoverable') {
      potentially_recoverable_value += payment.amount;
    }
  }

  return {
    payments_analyzed: payments.length,
    provider_used: provider.providerType,
    model_used: provider.modelName,
    ai_recommendations_count,
    policy_overrides_count,
    fallbacks_count,
    action_distribution,
    total_revenue_at_risk: Math.round(total_revenue_at_risk * 100) / 100,
    potentially_recoverable_value: Math.round(potentially_recoverable_value * 100) / 100,
    recovered_revenue: 0, // Strict invariant: Zero payments executed in Phase 3
    assessments,
  };
}
