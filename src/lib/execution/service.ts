import type { PaymentRecord, RecoveryExecutionRecord } from '../types.ts';
import type { RecoveryAction } from '../recovery/types.ts';
import type {
  ExecutionMode,
  RecoveryExecutionResult,
  ExecutionPreview,
  BatchExecutionResult,
  BatchExecutionSummary,
  RecoveryExecutor,
} from './types.ts';
import {
  getPaymentById,
  getAtRiskPayments,
  saveRecoveryExecution,
  getRecoveryExecutionsByPaymentId,
  getSuccessfulRecovery,
  getRecoveredRevenue,
} from '../db.ts';
import { assessPaymentWithAI } from '../llm/service.ts';
import { verifyExecutionEligibility } from './gate.ts';
import { MockRecoveryExecutor } from './executors/mock.ts';
import { RazorpayTestExecutor } from './executors/razorpay.ts';

/**
 * Returns active execution mode configured in environment.
 * Defaults to 'mock' ensuring 100% offline, zero-credential safety.
 */
export function getExecutionMode(overrideMode?: ExecutionMode): ExecutionMode {
  if (overrideMode === 'razorpay_test') return 'razorpay_test';
  if (overrideMode === 'mock') return 'mock';
  const envMode = (process.env.RECOVERY_EXECUTION_MODE || 'mock').toLowerCase().trim();
  if (envMode === 'razorpay_test') return 'razorpay_test';
  return 'mock';
}

/**
 * Returns the recovery executor instance matching the active execution mode.
 */
export function getExecutor(modeOverride?: ExecutionMode): RecoveryExecutor {
  const mode = getExecutionMode(modeOverride);
  if (mode === 'razorpay_test') {
    return new RazorpayTestExecutor();
  }
  return new MockRecoveryExecutor();
}

/**
 * Generates an Execution Preview for a given payment without mutating state.
 * Allows operators to verify policy clearance, stop conditions, and amounts prior to execution.
 */
export async function getExecutionPreview(
  paymentId: string,
  modeOverride?: ExecutionMode
): Promise<ExecutionPreview | null> {
  const payment = getPaymentById(paymentId);
  if (!payment) return null;

  const mode = getExecutionMode(modeOverride);
  const audit = await assessPaymentWithAI(payment);
  const gate = verifyExecutionEligibility(payment, audit.final_decision);
  const pastExecutions = getRecoveryExecutionsByPaymentId(paymentId);
  const existingSuccess = getSuccessfulRecovery(paymentId);

  const policyStatus: 'approved' | 'overridden' | 'rejected' = audit.policy_overridden
    ? 'overridden'
    : audit.policy_result.allowed
    ? 'approved'
    : 'rejected';

  return {
    payment_id: payment.payment_id,
    customer_name: payment.customer_name,
    amount_at_risk: payment.amount,
    proposed_action: audit.final_decision.action,
    policy_status: policyStatus,
    policy_rule: audit.final_decision.policy_rule,
    stop_condition: audit.final_decision.stop_condition,
    execution_eligibility: gate.eligibility,
    execution_mode: mode,
    maximum_recoverable_amount: audit.final_decision.action === 'retry_payment' ? payment.amount : 0,
    already_executed: pastExecutions.length > 0,
    previous_execution: pastExecutions.length > 0 ? pastExecutions[pastExecutions.length - 1] : null,
    block_reason: gate.block_reason,
  };
}

// In-memory concurrency lock per payment_id to prevent race conditions during rapid or concurrent executions
const paymentLocks = new Map<string, Promise<void>>();

async function withPaymentLock<T>(paymentId: string, fn: () => Promise<T>): Promise<T> {
  while (paymentLocks.has(paymentId)) {
    try {
      await paymentLocks.get(paymentId);
    } catch {
      // Continue if previous lock errored
    }
  }

  let resolveLock!: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    resolveLock = resolve;
  });
  paymentLocks.set(paymentId, lockPromise);

  try {
    return await fn();
  } finally {
    paymentLocks.delete(paymentId);
    resolveLock();
  }
}

/**
 * Executes a policy-approved recovery action for a single payment.
 *
 * CRITICAL DEFENSE IN DEPTH:
 * 1. Server determines the action from AI + Policy Validation (client cannot specify action).
 * 2. Execution Gate enforces retry limits, stopping rules, and idempotency.
 * 3. Idempotency guard prevents duplicate recovery of already-recovered funds.
 * 4. Outcome is permanently written to SQLite recovery_executions.
 * 5. Per-payment mutex prevents concurrent double-execution race conditions.
 */
export async function executeRecoveryForPayment(
  paymentId: string,
  modeOverride?: ExecutionMode
): Promise<RecoveryExecutionResult> {
  const payment = getPaymentById(paymentId);
  if (!payment) {
    throw new Error(`Payment with ID '${paymentId}' not found.`);
  }

  return withPaymentLock(paymentId, async () => {
    // 0. DOUBLE-CHECK IDEMPOTENCY: Check inside the serialized lock
    const existingRecovery = getSuccessfulRecovery(payment.payment_id);
    if (existingRecovery) {
      return {
        execution_id: existingRecovery.execution_id,
        payment_id: payment.payment_id,
        assessment_id: existingRecovery.assessment_id,
        action: existingRecovery.action as RecoveryAction,
        status: 'succeeded',
        amount_attempted: existingRecovery.amount_attempted,
        amount_recovered: existingRecovery.amount_recovered,
        execution_mode: existingRecovery.execution_mode,
        failure_reason: 'Payment has already been successfully recovered (idempotent guard active).',
        timestamp: existingRecovery.created_at,
        policy_rule: existingRecovery.policy_rule,
        decision_source: existingRecovery.decision_source,
        provider: existingRecovery.provider,
        model: existingRecovery.model,
        already_recovered: true,
      };
    }

    const executor = getExecutor(modeOverride);

    // 1. Generate full AI Reasoning + Deterministic Policy Assessment
    const audit = await assessPaymentWithAI(payment);
    const decision = audit.final_decision;

    // 2. Execution Gate Defense: Verify policy eligibility and idempotency
    const gate = verifyExecutionEligibility(payment, decision);

    // 3. IDEMPOTENCY CHECK: If already recovered, return existing success without re-crediting
    if (gate.eligibility === 'already_recovered') {
      const existing = getSuccessfulRecovery(paymentId);
      if (existing) {
        return {
          execution_id: existing.execution_id,
          payment_id: payment.payment_id,
          assessment_id: existing.assessment_id,
          action: existing.action as RecoveryAction,
          status: 'succeeded',
          amount_attempted: existing.amount_attempted,
          amount_recovered: existing.amount_recovered,
          execution_mode: existing.execution_mode,
          failure_reason: 'Payment has already been successfully recovered (idempotent guard active).',
          timestamp: existing.created_at,
          policy_rule: existing.policy_rule,
          decision_source: existing.decision_source,
          provider: existing.provider,
          model: existing.model,
          already_recovered: true,
        };
      }
    }

  // 4. POLICY BLOCK CHECK: If execution gate reports blocked, persist blocked audit
  if (!gate.eligible) {
    const blockedRecord: RecoveryExecutionRecord = {
      execution_id: `rec_exec_block_${payment.payment_id}_${Date.now()}`,
      payment_id: payment.payment_id,
      assessment_id: audit.assessment_id,
      action: decision.action,
      execution_mode: executor.mode,
      status: 'blocked',
      amount_attempted: payment.amount,
      amount_recovered: 0,
      policy_rule: decision.policy_rule,
      decision_source: audit.decision_source,
      provider: audit.provider,
      model: audit.model,
      failure_reason: gate.block_reason || 'Execution blocked by policy engine safety boundary.',
      created_at: new Date().toISOString(),
    };

    saveRecoveryExecution(blockedRecord);

    return {
      execution_id: blockedRecord.execution_id,
      payment_id: payment.payment_id,
      assessment_id: blockedRecord.assessment_id,
      action: decision.action,
      status: 'blocked',
      amount_attempted: blockedRecord.amount_attempted,
      amount_recovered: 0,
      execution_mode: executor.mode,
      failure_reason: blockedRecord.failure_reason || undefined,
      timestamp: blockedRecord.created_at,
      policy_rule: decision.policy_rule,
      decision_source: audit.decision_source,
      provider: audit.provider,
      model: audit.model,
    };
  }

  // 5. Execute action via configured executor
  const result = await executor.execute(payment, decision, audit);

  // 6. Persist execution record in SQLite audit ledger
  const recordToSave: RecoveryExecutionRecord = {
    execution_id: result.execution_id,
    payment_id: result.payment_id,
    assessment_id: result.assessment_id,
    action: result.action,
    execution_mode: result.execution_mode,
    status: result.status,
    amount_attempted: result.amount_attempted,
    amount_recovered: result.amount_recovered,
    policy_rule: result.policy_rule,
    decision_source: result.decision_source,
    provider: result.provider || null,
    model: result.model || null,
    failure_reason: result.failure_reason || null,
    created_at: result.timestamp,
  };

  saveRecoveryExecution(recordToSave);

  return result;
  });
}

/**
 * Executes bounded recovery actions in batch across at-risk payments.
 * Sequential execution prevents concurrency races and guarantees idempotency.
 */
export async function executeRecoveryBatch(
  paymentIds?: string[],
  modeOverride?: ExecutionMode
): Promise<BatchExecutionResult> {
  const mode = getExecutionMode(modeOverride);
  let targets: PaymentRecord[] = [];

  if (paymentIds && paymentIds.length > 0) {
    for (const id of paymentIds) {
      const p = getPaymentById(id);
      if (p) targets.push(p);
    }
  } else {
    targets = getAtRiskPayments();
  }

  const executions: RecoveryExecutionResult[] = [];
  let attempted = 0;
  let successful = 0;
  let failed = 0;
  let blocked = 0;
  let customerActionRequired = 0;
  let escalated = 0;
  let noAction = 0;
  let totalRevenueAtRisk = 0;

  for (const payment of targets) {
    if (payment.status === 'failed' || payment.status === 'abandoned') {
      totalRevenueAtRisk += payment.amount;
    }

    try {
      const execResult = await executeRecoveryForPayment(payment.payment_id, modeOverride);
      executions.push(execResult);

      if (execResult.status === 'succeeded') {
        successful++;
        attempted++;
      } else if (execResult.status === 'failed') {
        failed++;
        attempted++;
      } else if (execResult.status === 'blocked') {
        blocked++;
      } else if (execResult.status === 'customer_action_required') {
        customerActionRequired++;
      } else if (execResult.status === 'escalated') {
        escalated++;
      } else if (execResult.status === 'no_action') {
        noAction++;
      }
    } catch (err: unknown) {
      console.error(`Error executing recovery for ${payment.payment_id}:`, err);
      blocked++;
    }
  }

  // Calculate live recovered revenue strictly from persistent database records
  const recoveredRevenue = getRecoveredRevenue();

  const summary: BatchExecutionSummary = {
    analyzed: targets.length,
    attempted,
    successful,
    failed,
    blocked,
    customer_action_required: customerActionRequired,
    escalated,
    no_action: noAction,
    total_revenue_at_risk: Math.round(totalRevenueAtRisk * 100) / 100,
    recovered_revenue: recoveredRevenue,
    recovery_rate:
      totalRevenueAtRisk > 0 ? Math.round((recoveredRevenue / totalRevenueAtRisk) * 10000) / 100 : 0,
    recovery_attempt_rate:
      targets.length > 0 ? Math.round((attempted / targets.length) * 10000) / 100 : 0,
    recovery_success_rate:
      attempted > 0 ? Math.round((successful / attempted) * 10000) / 100 : 0,
    execution_mode: mode,
  };

  return {
    summary,
    executions,
  };
}
