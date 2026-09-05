export type RecoveryAction =
  | 'retry_payment'
  | 'contact_customer'
  | 'request_payment_method_update'
  | 'escalate_to_human'
  | 'do_nothing';

export type RecoveryClassification =
  | 'recoverable'
  | 'unlikely_recoverable'
  | 'requires_escalation';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface ProposedDecision {
  classification: RecoveryClassification;
  diagnosis: string;
  action: RecoveryAction;
  confidence: number;
  reason: string;
  risk_level: RiskLevel;
}

export interface PolicyValidationResult {
  allowed: boolean;
  final_action: RecoveryAction;
  policy_rule: string;
  stop_condition: string;
  reason: string;
  overridden: boolean;
}

export interface RecoveryDecision {
  payment_id: string;
  classification: RecoveryClassification;
  diagnosis: string;
  action: RecoveryAction;
  confidence: number;
  reason: string;
  policy_rule: string;
  stop_condition: string;
  risk_level: RiskLevel;
  policy_overridden: boolean;
  original_action?: RecoveryAction;
}

export interface BatchRecoveryMetrics {
  payments_analyzed: number;
  recoverable_count: number;
  unlikely_recoverable_count: number;
  escalation_count: number;
  retry_recommendation_count: number;
  customer_contact_count: number;
  payment_method_update_count: number;
  do_nothing_count: number;
  total_revenue_at_risk: number;
  potentially_recoverable_value: number;
}
