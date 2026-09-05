import type {
  RecoveryAction,
  RecoveryClassification,
  RiskLevel,
  RecoveryDecision,
  PolicyValidationResult,
} from '../recovery/types.ts';

export type LLMProviderType = 'mock' | 'ollama' | 'openai' | 'gemini';

export interface LLMRecommendation {
  classification: RecoveryClassification;
  diagnosis: string;
  recommended_action: RecoveryAction;
  confidence: number; // Strictly bounded [0.0, 1.0]
  reason: string;
  risk_level: RiskLevel;
}

export interface PaymentContext {
  payment: {
    payment_id: string;
    amount: number;
    currency: string;
    status: string;
    failure_reason: string | null;
    attempt_count: number;
    created_at: string;
    last_attempt_at: string;
    payment_method_type: string;
    payment_method_detail: string;
  };
  customer: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    subscription_status: string;
    previous_successful_payments: number;
    previous_failed_payments: number;
    total_history: number;
    success_rate: number | null;
    reputation: string;
  };
  policy_constraints: {
    max_automatic_retries: number;
    max_bank_decline_retries: number;
    high_value_threshold: number;
    stopping_rule_guidance: string;
  };
}

export interface LLMProvider {
  readonly providerType: LLMProviderType;
  readonly modelName: string;
  analyzePayment(context: PaymentContext): Promise<LLMRecommendation>;
}

export interface AIAssessmentAudit {
  assessment_id: string;
  timestamp: string;
  payment_id: string;
  provider: LLMProviderType;
  model: string;
  ai_recommendation: LLMRecommendation | null;
  policy_result: PolicyValidationResult;
  final_decision: RecoveryDecision;
  decision_source: 'ai_with_policy_validation' | 'deterministic_fallback';
  fallback_occurred: boolean;
  fallback_reason?: string;
  policy_overridden: boolean;
}

export interface BatchAIAssessmentResult {
  payments_analyzed: number;
  provider_used: LLMProviderType;
  model_used: string;
  ai_recommendations_count: number;
  policy_overrides_count: number;
  fallbacks_count: number;
  action_distribution: Record<RecoveryAction, number>;
  total_revenue_at_risk: number;
  potentially_recoverable_value: number;
  recovered_revenue: number; // Strictly 0 in Phase 3
  assessments: AIAssessmentAudit[];
}
