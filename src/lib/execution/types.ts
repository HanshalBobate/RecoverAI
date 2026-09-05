import type { PaymentRecord, ExecutionMode, ExecutionStatus, RecoveryExecutionRecord } from '../types.ts';
import type { RecoveryAction, RecoveryDecision } from '../recovery/types.ts';
import type { AIAssessmentAudit } from '../llm/types.ts';

export type { ExecutionMode, ExecutionStatus, RecoveryExecutionRecord };

export interface RecoveryExecutionResult {
  execution_id: string;
  payment_id: string;
  assessment_id: string | null;
  action: RecoveryAction;
  status: ExecutionStatus;
  amount_attempted: number;
  amount_recovered: number;
  execution_mode: ExecutionMode;
  failure_reason?: string;
  timestamp: string;
  policy_rule: string;
  decision_source: string;
  provider?: string | null;
  model?: string | null;
  already_recovered?: boolean;
}

export type ExecutionEligibility =
  | 'eligible'
  | 'blocked'
  | 'customer_action_required'
  | 'already_recovered';

export interface ExecutionPreview {
  payment_id: string;
  customer_name: string;
  amount_at_risk: number;
  proposed_action: RecoveryAction;
  policy_status: 'approved' | 'overridden' | 'rejected';
  policy_rule: string;
  stop_condition: string;
  execution_eligibility: ExecutionEligibility;
  execution_mode: ExecutionMode;
  maximum_recoverable_amount: number;
  already_executed: boolean;
  previous_execution?: RecoveryExecutionRecord | null;
  block_reason?: string;
}

export interface RecoveryExecutor {
  readonly mode: ExecutionMode;
  execute(
    payment: PaymentRecord,
    decision: RecoveryDecision,
    assessmentAudit?: AIAssessmentAudit | null
  ): Promise<RecoveryExecutionResult>;
}

export interface BatchExecutionSummary {
  analyzed: number;
  attempted: number;
  successful: number;
  failed: number;
  blocked: number;
  customer_action_required: number;
  escalated: number;
  no_action: number;
  total_revenue_at_risk: number;
  recovered_revenue: number;
  recovery_rate: number;
  recovery_attempt_rate: number;
  recovery_success_rate: number;
  execution_mode: ExecutionMode;
}

export interface BatchExecutionResult {
  summary: BatchExecutionSummary;
  executions: RecoveryExecutionResult[];
}
