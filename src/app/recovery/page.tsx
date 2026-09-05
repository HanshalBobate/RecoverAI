'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Zap,
  Bot,
  ShieldCheck,
  Shield,
  Play,
  RotateCcw,
  RefreshCw,
  Mail,
  CreditCard,
  ShieldAlert,
  AlertCircle,
  ArrowRight,
  Lock,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { PaymentSummary, RecoveryExecutionRecord } from '@/lib/types';
import { MetricCard } from '@/components/MetricCard';
import { formatINR, formatDate } from '@/lib/format';
import type { BatchAIAssessmentResult } from '@/lib/llm/types';
import type { BatchExecutionResult } from '@/lib/execution/types';

/* ─── Inline style helpers ─────────── */
const sLabel: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 10,
  fontWeight: 500,
  color: 'var(--ink-muted)',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
};

function StatusPill({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color,
        background: bg,
        borderLeft: `2px solid ${color}`,
        borderRadius: 'var(--radius-subtle)',
        padding: '2px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function ExecStatusPill({ status }: { status: string }) {
  const m: Record<string, { color: string; bg: string }> = {
    succeeded:                { color: 'var(--accent-sage)',   bg: 'var(--accent-sage-light)' },
    blocked:                  { color: 'var(--accent-butter)', bg: 'var(--accent-butter-light)' },
    customer_action_required: { color: 'var(--accent-sky)',    bg: 'var(--accent-sky-light)' },
    failed:                   { color: 'var(--accent-clay)',   bg: 'var(--accent-clay-light)' },
  };
  const t = m[status] || { color: 'var(--ink-muted)', bg: 'var(--paper-alt)' };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
        fontWeight: 500,
        color: t.color,
        background: t.bg,
        borderLeft: `2px solid ${t.color}`,
        borderRadius: 'var(--radius-subtle)',
        padding: '2px 7px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function RecoveryPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [auditData, setAuditData] = useState<{
    metrics: {
      executions_total: number;
      successful_count: number;
      failed_count: number;
      blocked_count: number;
      customer_action_count: number;
      escalated_count: number;
      no_action_count: number;
      recovered_revenue: number;
    };
    executions: RecoveryExecutionRecord[];
  } | null>(null);

  const [isTriageLoading, setIsTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState<BatchAIAssessmentResult | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);

  const [isExecLoading, setIsExecLoading] = useState(false);
  const [execResult, setExecResult] = useState<BatchExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [sumRes, auditRes] = await Promise.allSettled([
        fetch('/api/payments/summary'),
        fetch('/api/recovery/audit?limit=20'),
      ]);
      if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
        const j = await sumRes.value.json();
        setSummary(j.data);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const j = await auditRes.value.json();
        setAuditData(j.data);
      }
    } catch (err) {
      console.error('Failed to load summary or audit data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Run AI Risk Triage
  const handleRunTriage = async () => {
    setIsTriageLoading(true);
    setTriageError(null);
    try {
      const res = await fetch('/api/recovery/ai-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete triage analysis');
      }
      setTriageResult(data.data);
    } catch (err) {
      setTriageError(err instanceof Error ? err.message : 'Unknown error during triage');
    } finally {
      setIsTriageLoading(false);
    }
  };

  // Run Batch Recovery Execution
  const handleRunBatchExecution = async () => {
    setIsExecLoading(true);
    setExecError(null);
    try {
      const res = await fetch('/api/recovery/execute-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete batch execution');
      }
      setExecResult(data.data);
      // Reload audit data and summary
      await loadData();
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Unknown error during batch execution');
    } finally {
      setIsExecLoading(false);
    }
  };

  const recoveredRevenue = auditData?.metrics?.recovered_revenue ?? 0;
  const potentiallyRecoverable = triageResult?.potentially_recoverable_value
    ?? (summary ? Math.round(summary.total_revenue_at_risk * 0.45) : 0);

  const recoveryRate = summary && summary.total_revenue_at_risk > 0 && recoveredRevenue > 0
    ? `${(Math.round((recoveredRevenue / summary.total_revenue_at_risk) * 1000) / 10).toFixed(1)}%`
    : '0.0%';

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* ── Page Header & Safety Status Strip ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ borderLeft: '3px solid var(--accent-clay)', paddingLeft: 14 }}>
          <h1
            style={{
              fontFamily: 'var(--font-editorial)',
              fontSize: 22,
              fontWeight: 500,
              color: 'var(--ink)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              marginBottom: 4,
            }}
          >
            Recovery Operations
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)' }}>
            Operational workspace for at-risk cohorts, AI triage analysis, and policy-governed batch execution.
          </p>
        </div>

        {/* Safety Status Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-medium)',
            padding: '6px 12px',
            flexWrap: 'wrap',
          }}
        >
          <StatusPill color="var(--accent-sage)" bg="var(--accent-sage-light)">
            <Zap style={{ width: 10, height: 10 }} />
            TEST MODE
          </StatusPill>
          <StatusPill color="var(--accent-sage)" bg="var(--accent-sage-light)">
            <ShieldCheck style={{ width: 10, height: 10 }} />
            POLICY CONTROLLED
          </StatusPill>
          <StatusPill color="var(--accent-lavender)" bg="var(--accent-lavender-light)">
            <Shield style={{ width: 10, height: 10 }} />
            IDEMPOTENT
          </StatusPill>
          <StatusPill color="var(--accent-butter)" bg="var(--accent-butter-light)">
            <Lock style={{ width: 10, height: 10 }} />
            NO LIVE MONEY
          </StatusPill>
        </div>
      </div>

      {/* ── Metrics Row ── */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MetricCard
            title="Revenue at Risk"
            value={summary ? formatINR(summary.total_revenue_at_risk) : '—'}
            subtext={summary ? `Failed: ${formatINR(summary.failed_revenue)} · Abandoned: ${formatINR(summary.abandoned_revenue)}` : 'Loading…'}
            icon={AlertTriangle}
            accentColor="rose"
            badgeText="Cohort"
          />
          <MetricCard
            title="Potentially Recoverable"
            value={formatINR(potentiallyRecoverable)}
            subtext="Model estimate — not realized until executed"
            icon={Cpu}
            accentColor="slate"
            badgeText="Analytical"
          />
          <MetricCard
            title="Recovered Revenue"
            value={formatINR(recoveredRevenue)}
            subtext={auditData && auditData.metrics.successful_count > 0
              ? `${auditData.metrics.successful_count} verified execution${auditData.metrics.successful_count > 1 ? 's' : ''}`
              : 'From successful execution records only'}
            icon={CheckCircle2}
            accentColor="emerald"
            badgeText="Realized"
          />
          <MetricCard
            title="Recovery Rate"
            value={recoveryRate}
            subtext={auditData ? `Attempted: ${(auditData.metrics.successful_count ?? 0) + (auditData.metrics.failed_count ?? 0)}` : 'Awaiting execution'}
            icon={Zap}
            accentColor="slate"
          />
        </div>
      </section>

      {/* ── Dual Workspace Cards: AI Triage vs Batch Execution ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Workspace Card 1: AI Risk Triage */}
        <div
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderTop: '3px solid var(--accent-lavender)',
            borderRadius: 'var(--radius-medium)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: 'var(--shadow-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-subtle)',
                  background: 'var(--accent-lavender-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-lavender)',
                }}
              >
                <Bot style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
                  AI Risk Triage
                </h2>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
                  Cohort diagnostic reasoning & policy verification
                </span>
              </div>
            </div>
            <StatusPill color="var(--accent-lavender)" bg="var(--accent-lavender-light)">
              MOCK PROVIDER
            </StatusPill>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              <strong>Operational Workflow: </strong>
              AI analyzes cohort telemetry → Deterministic policy engine validates each candidate action → Unsafe proposals (expired cards, retry limits) are strictly overridden.
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-lavender)' }}>
              Invariant: Realized revenue remains ₹0 during triage. Confidence ≠ financial recovery.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleRunTriage}
              disabled={isTriageLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'var(--ink)',
                color: 'var(--canvas)',
                border: 'none',
                borderRadius: 'var(--radius-subtle)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 500,
                cursor: isTriageLoading ? 'not-allowed' : 'pointer',
                opacity: isTriageLoading ? 0.7 : 1,
                transition: 'opacity 0.12s',
              }}
            >
              {isTriageLoading ? (
                <>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid var(--canvas)',
                      borderTopColor: 'transparent',
                    }}
                    className="animate-spin"
                  />
                  Triaging Cohort…
                </>
              ) : (
                <>
                  <Bot style={{ width: 14, height: 14 }} />
                  Analyze At-Risk Cohort
                </>
              )}
            </button>

            {triageResult && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-sage)' }}>
                ✓ {triageResult.payments_analyzed} payments evaluated
              </span>
            )}
          </div>

          {triageError && (
            <div
              style={{
                background: 'var(--accent-clay-light)',
                border: '1px solid var(--accent-clay)',
                borderRadius: 'var(--radius-subtle)',
                padding: '8px 12px',
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: 'var(--accent-clay)',
              }}
            >
              {triageError}
            </div>
          )}

          {/* Triage Output Summary */}
          {triageResult && (
            <div
              style={{
                background: 'var(--paper-alt)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-subtle)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={sLabel}>Policy Verdict Distribution</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--ink)' }}>
                  {formatINR(triageResult.potentially_recoverable_value)} potential
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent-sage)', fontWeight: 500 }}>APPROVED</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                    {triageResult.assessments?.filter((a) => a.policy_result?.allowed && !a.policy_result?.overridden).length ?? 0}
                  </div>
                </div>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent-butter)', fontWeight: 500 }}>OVERRIDDEN</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                    {triageResult.policy_overrides_count ?? 0}
                  </div>
                </div>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent-clay)', fontWeight: 500 }}>BLOCKED</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                    {triageResult.assessments?.filter((a) => !a.policy_result?.allowed).length ?? 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Workspace Card 2: Batch Recovery Execution */}
        <div
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderTop: '3px solid var(--accent-sage)',
            borderRadius: 'var(--radius-medium)',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: 'var(--shadow-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-subtle)',
                  background: 'var(--accent-sage-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-sage)',
                }}
              >
                <Zap style={{ width: 16, height: 16 }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
                  Batch Recovery Execution
                </h2>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
                  Policy-gated, deterministic execution run
                </span>
              </div>
            </div>
            <StatusPill color="var(--accent-sage)" bg="var(--accent-sage-light)">
              SAFETY GATE ACTIVE
            </StatusPill>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              <strong>Execution Gate: </strong>
              Executes only policy-approved recovery actions through the sequential safety gate. Enforces idempotency locks (double-click guard), terminal failure guards, and records persistent audit records.
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-sage)' }}>
              Invariant: Recovered Revenue = SUM(amount WHERE succeeded). Mode: Simulated Test.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleRunBatchExecution}
              disabled={isExecLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                background: 'var(--accent-sage)',
                color: 'var(--ink)',
                border: 'none',
                borderRadius: 'var(--radius-subtle)',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                fontWeight: 600,
                cursor: isExecLoading ? 'not-allowed' : 'pointer',
                opacity: isExecLoading ? 0.7 : 1,
                transition: 'opacity 0.12s',
              }}
            >
              {isExecLoading ? (
                <>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid var(--ink)',
                      borderTopColor: 'transparent',
                    }}
                    className="animate-spin"
                  />
                  Executing Batch…
                </>
              ) : (
                <>
                  <Play style={{ width: 14, height: 14, fill: 'currentColor' }} />
                  Execute Policy-Approved Batch
                </>
              )}
            </button>

            {execResult && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-sage)' }}>
                ✓ {execResult.summary.successful} recovered (+{formatINR(execResult.summary.recovered_revenue)})
              </span>
            )}
          </div>

          {execError && (
            <div
              style={{
                background: 'var(--accent-clay-light)',
                border: '1px solid var(--accent-clay)',
                borderRadius: 'var(--radius-subtle)',
                padding: '8px 12px',
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: 'var(--accent-clay)',
              }}
            >
              {execError}
            </div>
          )}

          {/* Post-Run Result Card */}
          {execResult && (
            <div
              style={{
                background: 'var(--paper-alt)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-subtle)',
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={sLabel}>Batch Run Execution Summary</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent-sage)' }}>
                  +{formatINR(execResult.summary.recovered_revenue)} Recovered
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--ink-muted)' }}>ANALYZED</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                    {execResult.summary.analyzed}
                  </div>
                </div>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent-sage)' }}>SUCCEEDED</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--accent-sage)', marginTop: 2 }}>
                    {execResult.summary.successful}
                  </div>
                </div>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent-butter)' }}>BLOCKED</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--accent-butter)', marginTop: 2 }}>
                    {execResult.summary.blocked}
                  </div>
                </div>
                <div style={{ background: 'var(--paper)', padding: '8px 10px', borderRadius: 'var(--radius-subtle)', border: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--accent-sky)' }}>OUTREACH</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--accent-sky)', marginTop: 2 }}>
                    {execResult.summary.customer_action_required}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Action Distribution Reference ── */}
      <section
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-medium)',
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
            Recovery Action Taxonomy
          </h2>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
            Deterministic Policy Engine Rule mapping
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            {
              action: 'retry_payment',
              label: 'Retry Payment',
              icon: <RefreshCw style={{ width: 13, height: 13 }} />,
              color: 'var(--accent-sage)',
              bg: 'var(--accent-sage-light)',
              rule: 'POL-001 (Transient Timeout)',
              cond: 'Transient gateway error, attempts < 3',
            },
            {
              action: 'contact_customer',
              label: 'Contact Customer',
              icon: <Mail style={{ width: 13, height: 13 }} />,
              color: 'var(--accent-sky)',
              bg: 'var(--accent-sky-light)',
              rule: 'POL-004 (Abandoned / Outreach)',
              cond: 'Cart abandoned, checkout timeout',
            },
            {
              action: 'request_payment_method_update',
              label: 'Request Update',
              icon: <CreditCard style={{ width: 13, height: 13 }} />,
              color: 'var(--accent-butter)',
              bg: 'var(--accent-butter-light)',
              rule: 'POL-002 (Expired / Invalid)',
              cond: 'Expired card, invalid account details',
            },
            {
              action: 'escalate_to_human',
              label: 'Escalate to Human',
              icon: <ShieldAlert style={{ width: 13, height: 13 }} />,
              color: 'var(--accent-clay)',
              bg: 'var(--accent-clay-light)',
              rule: 'POL-005 (Suspected Fraud/Risk)',
              cond: 'Velocity spike, bank risk flag',
            },
            {
              action: 'do_nothing',
              label: 'Do Nothing (Hold)',
              icon: <AlertCircle style={{ width: 13, height: 13 }} />,
              color: 'var(--ink-muted)',
              bg: 'var(--paper-alt)',
              rule: 'POL-003 (Exhausted Attempts)',
              cond: 'Terminal decline, attempts >= 3',
            },
          ].map((item) => (
            <div
              key={item.action}
              style={{
                background: 'var(--paper-alt)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${item.color}`,
                borderRadius: 'var(--radius-subtle)',
                padding: '10px 12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: item.color, marginBottom: 4 }}>
                {item.icon}
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>{item.label}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', marginBottom: 2 }}>
                {item.rule}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--ink-faint)', lineHeight: 1.3 }}>
                {item.cond}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Recent Execution Log in This Session ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
              Execution Ledger
            </h2>
            <StatusPill color="var(--accent-sage)" bg="var(--accent-sage-light)">
              {auditData?.metrics?.executions_total ?? 0} Recorded
            </StatusPill>
          </div>
          <Link
            href="/audit"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--accent-sage)',
              textDecoration: 'none',
            }}
          >
            View Full Audit Ledger
            <ExternalLink style={{ width: 12, height: 12 }} />
          </Link>
        </div>

        {auditData && auditData.executions && auditData.executions.length > 0 ? (
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-medium)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-surface)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--paper-alt)', borderBottom: '1px solid var(--border)' }}>
                  {['Execution ID', 'Payment', 'Action', 'Status', 'Attempted', 'Recovered', 'Policy Rule', 'Time', ''].map((h, i) => (
                    <th
                      key={h || i}
                      style={{
                        padding: '10px 14px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 10,
                        fontWeight: 500,
                        color: 'var(--ink-muted)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        textAlign: i === 4 || i === 5 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditData.executions.slice(0, 10).map((exec, idx) => (
                  <tr
                    key={exec.execution_id}
                    style={{
                      borderBottom: idx < Math.min(auditData.executions.length, 10) - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
                      {exec.execution_id.slice(0, 16)}…
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--ink)' }}>
                      <Link href={`/payments/${exec.payment_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        {exec.payment_id}
                      </Link>
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-secondary)', textTransform: 'capitalize' }}>
                      {exec.action.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <ExecStatusPill status={exec.status} />
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right', color: 'var(--ink-secondary)' }}>
                      {formatINR(exec.amount_attempted)}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textAlign: 'right', color: 'var(--accent-sage)' }}>
                      {exec.status === 'succeeded' ? formatINR(exec.amount_recovered) : '₹0'}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
                      {exec.policy_rule || 'POL-DEFAULT'}
                    </td>
                    <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-faint)' }}>
                      {new Date(exec.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <Link
                        href={`/payments/${exec.payment_id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          fontFamily: 'var(--font-sans)',
                          fontSize: 11,
                          color: 'var(--ink-muted)',
                          textDecoration: 'none',
                        }}
                      >
                        Inspect
                        <ChevronRight style={{ width: 12, height: 12 }} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-medium)',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-muted)' }}>
              No batch executions performed yet in this workspace.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
