import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import type { PaymentRecord, PaymentSummary, PaymentsFilterParams, RecoveryExecutionRecord } from './types';

let dbInstance: DatabaseSync | null = null;

export function getDatabasePath(): string {
  const customPath = process.env.DATABASE_PATH;
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath);
  }
  return path.join(process.cwd(), 'data', 'recoverai.db');
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      payment_id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      failure_reason TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_attempt_at TEXT NOT NULL,
      subscription_status TEXT NOT NULL DEFAULT 'active',
      previous_successful_payments INTEGER NOT NULL DEFAULT 0,
      previous_failed_payments INTEGER NOT NULL DEFAULT 0,
      payment_method_type TEXT NOT NULL DEFAULT 'card',
      payment_method_detail TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_failure_reason ON payments(failure_reason);
    CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);

    CREATE TABLE IF NOT EXISTS recovery_executions (
      execution_id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      assessment_id TEXT,
      action TEXT NOT NULL,
      execution_mode TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_attempted REAL NOT NULL,
      amount_recovered REAL NOT NULL DEFAULT 0,
      policy_rule TEXT NOT NULL,
      decision_source TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      failure_reason TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recovery_executions_payment_id ON recovery_executions(payment_id);
    CREATE INDEX IF NOT EXISTS idx_recovery_executions_status ON recovery_executions(status);
    CREATE INDEX IF NOT EXISTS idx_recovery_executions_created_at ON recovery_executions(created_at);
  `);
}

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  initSchema(db);
  dbInstance = db;
  return db;
}

export function getPayments(params: PaymentsFilterParams = {}): { payments: PaymentRecord[]; total: number } {
  const db = getDb();
  const whereClauses: string[] = [];
  const queryParams: (string | number)[] = [];

  if (params.status && params.status !== 'all') {
    whereClauses.push('status = ?');
    queryParams.push(params.status);
  }

  if (params.failure_reason && params.failure_reason !== 'all') {
    whereClauses.push('failure_reason = ?');
    queryParams.push(params.failure_reason);
  }

  if (params.search && params.search.trim() !== '') {
    const term = `%${params.search.trim()}%`;
    whereClauses.push('(customer_name LIKE ? OR customer_email LIKE ? OR payment_id LIKE ?)');
    queryParams.push(term, term, term);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count matching filter
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM payments ${whereString}`);
  const countResult = countStmt.get(...queryParams) as { count: number };
  const total = countResult ? countResult.count : 0;

  // Pagination
  const limit = params.limit ?? 250;
  const offset = params.offset ?? 0;

  const dataStmt = db.prepare(`
    SELECT * FROM payments
    ${whereString}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `);

  const payments = dataStmt.all(...queryParams, limit, offset) as unknown as PaymentRecord[];
  return { payments, total };
}

export function getPaymentById(paymentId: string): PaymentRecord | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM payments WHERE payment_id = ?');
  const record = stmt.get(paymentId) as unknown as PaymentRecord | undefined;
  return record || null;
}

export function getAtRiskPayments(): PaymentRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM payments 
    WHERE status IN ('failed', 'abandoned')
    ORDER BY created_at DESC
  `);
  return stmt.all() as unknown as PaymentRecord[];
}

export function getPaymentsSummary(): PaymentSummary {
  const db = getDb();

  const allPayments = db.prepare('SELECT status, failure_reason, amount FROM payments').all() as unknown as {
    status: string;
    failure_reason: string | null;
    amount: number;
  }[];

  let total_payments = 0;
  let failed_payments = 0;
  let abandoned_payments = 0;
  let pending_payments = 0;
  let successful_payments = 0;

  let failed_revenue = 0;
  let abandoned_revenue = 0;
  let pending_revenue = 0;
  let successful_revenue = 0;

  const by_failure_reason: Record<string, { count: number; amount: number }> = {};
  const by_status: Record<string, { count: number; amount: number }> = {};

  for (const p of allPayments) {
    total_payments++;
    const amt = p.amount;

    // Status aggregation
    if (!by_status[p.status]) {
      by_status[p.status] = { count: 0, amount: 0 };
    }
    by_status[p.status].count++;
    by_status[p.status].amount += amt;

    if (p.status === 'failed') {
      failed_payments++;
      failed_revenue += amt;
    } else if (p.status === 'abandoned') {
      abandoned_payments++;
      abandoned_revenue += amt;
    } else if (p.status === 'pending') {
      pending_payments++;
      pending_revenue += amt;
    } else if (p.status === 'successful') {
      successful_payments++;
      successful_revenue += amt;
    }

    // Failure reason aggregation
    if (p.failure_reason) {
      if (!by_failure_reason[p.failure_reason]) {
        by_failure_reason[p.failure_reason] = { count: 0, amount: 0 };
      }
      by_failure_reason[p.failure_reason].count++;
      by_failure_reason[p.failure_reason].amount += amt;
    }
  }

  // Total revenue at risk: Failed + Abandoned checkouts
  const total_revenue_at_risk = failed_revenue + abandoned_revenue;

  return {
    total_payments,
    failed_payments,
    abandoned_payments,
    pending_payments,
    successful_payments,
    total_revenue_at_risk,
    failed_revenue,
    abandoned_revenue,
    pending_revenue,
    successful_revenue,
    by_failure_reason,
    by_status,
  };
}

/**
 * Persists an execution outcome record into recovery_executions.
 */
export function saveRecoveryExecution(execution: RecoveryExecutionRecord): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO recovery_executions (
      execution_id,
      payment_id,
      assessment_id,
      action,
      execution_mode,
      status,
      amount_attempted,
      amount_recovered,
      policy_rule,
      decision_source,
      provider,
      model,
      failure_reason,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const sanitizedAttempted = Math.max(0, Math.round((execution.amount_attempted || 0) * 100) / 100);
  const sanitizedRecovered = Math.max(0, Math.round((execution.amount_recovered || 0) * 100) / 100);

  stmt.run(
    execution.execution_id,
    execution.payment_id,
    execution.assessment_id,
    execution.action,
    execution.execution_mode,
    execution.status,
    sanitizedAttempted,
    sanitizedRecovered,
    execution.policy_rule,
    execution.decision_source,
    execution.provider,
    execution.model,
    execution.failure_reason,
    execution.created_at
  );
}

/**
 * Returns all execution records for a specific payment, ordered chronologically.
 */
export function getRecoveryExecutionsByPaymentId(paymentId: string): RecoveryExecutionRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recovery_executions
    WHERE payment_id = ?
    ORDER BY created_at ASC
  `);
  return stmt.all(paymentId) as unknown as RecoveryExecutionRecord[];
}

/**
 * Returns the successful recovery execution record for a payment if one exists.
 * Used for idempotency validation to prevent double-counting.
 */
export function getSuccessfulRecovery(paymentId: string): RecoveryExecutionRecord | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recovery_executions
    WHERE payment_id = ? AND status = 'succeeded'
    LIMIT 1
  `);
  const record = stmt.get(paymentId) as unknown as RecoveryExecutionRecord | undefined;
  return record || null;
}

/**
 * Returns recent recovery execution audit records across the system.
 */
export function getAllRecoveryExecutions(limit: number = 100): RecoveryExecutionRecord[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM recovery_executions
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as unknown as RecoveryExecutionRecord[];
}

/**
 * STRICT ACCOUNTING FORMULA:
 * Recovered revenue is calculated EXCLUSIVELY from successful execution records.
 * recovered_revenue = SUM(amount_recovered WHERE status = 'succeeded')
 */
export function getRecoveredRevenue(): number {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(amount_recovered), 0) as total
    FROM recovery_executions
    WHERE status = 'succeeded'
  `);
  const res = stmt.get() as { total: number };
  return res ? Math.round(res.total * 100) / 100 : 0;
}

/**
 * Returns aggregate metrics across all recovery executions.
 */
export function getExecutionMetrics(): {
  executions_total: number;
  successful_count: number;
  failed_count: number;
  blocked_count: number;
  customer_action_count: number;
  escalated_count: number;
  no_action_count: number;
  recovered_revenue: number;
} {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as executions_total,
      SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successful_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
      SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
      SUM(CASE WHEN status = 'customer_action_required' THEN 1 ELSE 0 END) as customer_action_count,
      SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated_count,
      SUM(CASE WHEN status = 'no_action' THEN 1 ELSE 0 END) as no_action_count,
      COALESCE(SUM(amount_recovered), 0) as recovered_revenue
    FROM recovery_executions
  `);
  const row = stmt.get() as {
    executions_total: number;
    successful_count: number;
    failed_count: number;
    blocked_count: number;
    customer_action_count: number;
    escalated_count: number;
    no_action_count: number;
    recovered_revenue: number;
  };

  return {
    executions_total: row.executions_total || 0,
    successful_count: row.successful_count || 0,
    failed_count: row.failed_count || 0,
    blocked_count: row.blocked_count || 0,
    customer_action_count: row.customer_action_count || 0,
    escalated_count: row.escalated_count || 0,
    no_action_count: row.no_action_count || 0,
    recovered_revenue: Math.round((row.recovered_revenue || 0) * 100) / 100,
  };
}
