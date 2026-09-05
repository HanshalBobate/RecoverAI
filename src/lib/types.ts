export type PaymentStatus = 'successful' | 'failed' | 'pending' | 'abandoned';

export type FailureReason =
  | 'insufficient_funds'
  | 'bank_decline'
  | 'expired_card'
  | 'timeout'
  | 'authentication_failure'
  | 'gateway_error'
  | 'checkout_abandoned';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'trialing'
  | 'canceled'
  | 'unpaid';

export type PaymentMethodType = 'card' | 'upi' | 'netbanking';

export interface PaymentRecord {
  payment_id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failure_reason: FailureReason | null;
  attempt_count: number;
  created_at: string;
  last_attempt_at: string;
  subscription_status: SubscriptionStatus;
  previous_successful_payments: number;
  previous_failed_payments: number;
  payment_method_type: PaymentMethodType;
  payment_method_detail: string;
}

export interface PaymentSummary {
  total_payments: number;
  failed_payments: number;
  abandoned_payments: number;
  pending_payments: number;
  successful_payments: number;
  total_revenue_at_risk: number; // failed + abandoned
  failed_revenue: number;
  abandoned_revenue: number;
  pending_revenue: number;
  successful_revenue: number;
  by_failure_reason: Record<string, { count: number; amount: number }>;
  by_status: Record<string, { count: number; amount: number }>;
}

export interface PaymentsFilterParams {
  status?: string;
  failure_reason?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export type ExecutionMode = 'mock' | 'razorpay_test';

export type ExecutionStatus =
  | 'succeeded'
  | 'failed'
  | 'blocked'
  | 'customer_action_required'
  | 'escalated'
  | 'no_action';

export interface RecoveryExecutionRecord {
  execution_id: string;
  payment_id: string;
  assessment_id: string | null;
  action: string;
  execution_mode: ExecutionMode;
  status: ExecutionStatus;
  amount_attempted: number;
  amount_recovered: number;
  policy_rule: string;
  decision_source: string;
  provider: string | null;
  model: string | null;
  failure_reason: string | null;
  created_at: string;
}
