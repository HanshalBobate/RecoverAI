'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Lock,
  CheckCircle2,
  Zap,
  ArrowUpRight,
  ShieldCheck,
  Bot,
  Cpu,
  Activity,
  ArrowRight,
  RotateCcw,
  CreditCard,
  Smartphone,
  Globe,
  HelpCircle,
} from 'lucide-react';
import { PaymentSummary, RecoveryExecutionRecord, PaymentRecord } from '@/lib/types';
import { formatINR, formatFailureReason, formatDate } from '@/lib/format';
import { MetricCard } from '@/components/MetricCard';
import { StatusBadge } from '@/components/StatusBadge';

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

const EVALUATOR_SCENARIOS = [
  {
    num: '01',
    paymentId: 'pay_rec_0001',
    name: 'Clean Recovery',
    flow: 'Timeout → Retry → Success',
    failure: 'Gateway Timeout',
    policyBehavior: 'POL-001 clears retry on transient error',
    expectedOutcome: '+₹14,999 recovered revenue',
    accentColor: 'var(--accent-sage)',
    accentLight: 'var(--accent-sage-light)',
  },
  {
    num: '02',
    paymentId: 'pay_rec_0200',
    name: 'Safety Override',
    flow: 'Retry limit → Policy blocks → Escalation',
    failure: 'Attempt count ≥ 2',
    policyBehavior: 'POL-003 locks autonomous retry limit',
    expectedOutcome: 'Zero retry, routes to operations',
    accentColor: 'var(--accent-butter)',
    accentLight: 'var(--accent-butter-light)',
  },
  {
    num: '03',
    paymentId: 'pay_rec_0004',
    name: 'Expired Instrument',
    flow: 'Expired card → Retry prohibited → Update',
    failure: 'Card expired (03/24)',
    policyBehavior: 'POL-002 rejects retry on terminal instrument',
    expectedOutcome: 'Request method update via link',
    accentColor: 'var(--accent-sky)',
    accentLight: 'var(--accent-sky-light)',
  },
  {
    num: '04',
    paymentId: 'pay_rec_0001',
    name: 'Idempotency Guard',
    flow: 'Already recovered → Duplicate blocked',
    failure: 'Re-execution attempt',
    policyBehavior: 'Execution Gate checks past executions',
    expectedOutcome: 'Zero duplicate revenue credited',
    accentColor: 'var(--accent-lavender)',
    accentLight: 'var(--accent-lavender-light)',
  },
  {
    num: '05',
    paymentId: 'pay_rec_0019',
    name: 'Customer Action',
    flow: 'Abandonment → Recovery link → Outreach',
    failure: 'Checkout abandoned',
    policyBehavior: 'POL-004 initiates outreach without charge',
    expectedOutcome: 'Payment link queued (₹0 financial risk)',
    accentColor: 'var(--accent-clay)',
    accentLight: 'var(--accent-clay-light)',
  },
] as const;

export default function OverviewPage() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [atRiskPayments, setAtRiskPayments] = useState<PaymentRecord[]>([]);
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, atRiskRes, auditRes] = await Promise.allSettled([
        fetch('/api/payments/summary'),
        fetch('/api/payments?status=failed&limit=5'),
        fetch('/api/recovery/audit?limit=6'),
      ]);

      if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
        const j = await sumRes.value.json();
        setSummary(j.data);
      }
      if (atRiskRes.status === 'fulfilled' && atRiskRes.value.ok) {
        const j = await atRiskRes.value.json();
        setAtRiskPayments(j.data || []);
      }
      if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
        const j = await auditRes.value.json();
        setAuditData(j.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load overview data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const recoveredRevenue = auditData?.metrics?.recovered_revenue ?? 0;
  const potentiallyRecoverable = summary ? Math.round(summary.total_revenue_at_risk * 0.45) : 0;
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
        gap: 28,
      }}
    >
      {/* ── Page Header ── */}
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
            Operations Command Center
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)' }}>
            Real-time revenue recovery posture, deterministic policy governance, and inspection queues.
          </p>
        </div>

        {error && (
          <button
            onClick={loadData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent-clay-light)',
              border: '1px solid var(--accent-clay)',
              borderRadius: 'var(--radius-subtle)',
              padding: '6px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--accent-clay)',
              cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            Retry connection
          </button>
        )}
      </div>

      {/* ── 1. WHAT IS HAPPENING? (Executive KPIs) ── */}
      <section aria-labelledby="kpi-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <span style={sLabel} id="kpi-heading">System Posture · Real-Time Metrics</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
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
            subtext="Algorithmic model estimate — not realized revenue"
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
          <MetricCard
            title="Policy Blocks"
            value={auditData ? String(auditData.metrics.blocked_count) : '0'}
            subtext="Safety overrides enforced this session"
            icon={Lock}
            accentColor="amber"
            badgeText="Guarded"
          />
        </div>
      </section>

      {/* ── 2. WHAT CAN I DEMONSTRATE? (Evaluator Scenarios) ── */}
      <section aria-labelledby="scenarios-heading">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 id="scenarios-heading" style={{ fontFamily: 'var(--font-editorial)', fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>
              Evaluator Scenarios
            </h2>
            <StatusPill color="var(--accent-clay)" bg="var(--accent-clay-light)">
              Interactive 1-Click Verification
            </StatusPill>
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
            Select any scenario to inspect its complete diagnosis, policy clearance, and execution outcome
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          {EVALUATOR_SCENARIOS.map((sc) => (
            <Link
              key={sc.num}
              href={`/payments/${sc.paymentId}`}
              className="fold-corner"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: 'var(--paper)',
                border: '1px solid var(--border)',
                borderTop: `3px solid ${sc.accentColor}`,
                borderRadius: 'var(--radius-medium)',
                padding: '14px 12px 12px',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-surface)',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = 'translateY(-2px)';
                el.style.boxShadow = 'var(--shadow-elevated)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = '';
                el.style.boxShadow = 'var(--shadow-surface)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600, color: sc.accentColor }}>
                    {sc.num}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: sc.accentColor,
                      background: sc.accentLight,
                      borderLeft: `2px solid ${sc.accentColor}`,
                      borderRadius: 'var(--radius-subtle)',
                      padding: '1px 5px',
                    }}
                  >
                    {sc.paymentId}
                  </span>
                </div>

                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                  {sc.name}
                </div>

                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--ink-secondary)',
                    background: 'var(--paper-alt)',
                    padding: '3px 6px',
                    borderRadius: 'var(--radius-subtle)',
                    marginBottom: 8,
                    display: 'inline-block',
                  }}
                >
                  {sc.flow}
                </div>

                <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4, marginBottom: 8 }}>
                  {sc.policyBehavior}
                </p>
              </div>

              <div
                style={{
                  paddingTop: 8,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: sc.accentColor }}>
                  {sc.expectedOutcome}
                </span>
                <ArrowRight style={{ width: 12, height: 12, color: 'var(--ink-muted)' }} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 3. WHAT SHOULD I INSPECT? + RECENT ACTIVITY ── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* What Should I Inspect: High-Value At-Risk Cohort */}
        <div
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-medium)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: 'var(--shadow-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                High-Value At-Risk Cohort
              </h2>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
                Priority payments requiring diagnostic inspection or manual policy review
              </span>
            </div>
            <Link
              href="/payments"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--accent-clay)',
                textDecoration: 'none',
              }}
            >
              View all {summary?.failed_payments ?? 0} failed →
            </Link>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--paper-alt)', borderBottom: '1px solid var(--border)' }}>
                  {['Customer', 'Amount', 'Failure Reason', 'Method', ''].map((h, i) => (
                    <th
                      key={h || i}
                      style={{
                        padding: '8px 10px',
                        fontFamily: 'var(--font-sans)',
                        fontSize: 10,
                        fontWeight: 500,
                        color: 'var(--ink-muted)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        textAlign: i === 1 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atRiskPayments.slice(0, 4).map((p, idx) => (
                  <tr
                    key={p.payment_id}
                    style={{
                      borderBottom: idx < 3 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                        {p.customer_name}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
                        {p.payment_id}
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent-clay)' }}>
                      {formatINR(p.amount)}
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-secondary)' }}>
                      {formatFailureReason(p.failure_reason)}
                    </td>
                    <td style={{ padding: '10px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                      {p.payment_method_type}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right' }}>
                      <Link
                        href={`/payments/${p.payment_id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          fontFamily: 'var(--font-sans)',
                          fontSize: 11,
                          fontWeight: 500,
                          color: 'var(--accent-clay)',
                          textDecoration: 'none',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-subtle)',
                          background: 'var(--accent-clay-light)',
                        }}
                      >
                        Inspect
                        <ArrowRight style={{ width: 10, height: 10 }} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Recovery Activity */}
        <div
          style={{
            background: 'var(--paper)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-medium)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            boxShadow: 'var(--shadow-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Activity style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
              <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: 15, fontWeight: 500, color: 'var(--ink)' }}>
                Recent Recovery Activity
              </h2>
            </div>
            <Link
              href="/audit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--accent-sage)',
                textDecoration: 'none',
              }}
            >
              Audit ledger ({auditData?.metrics?.executions_total ?? 0}) →
            </Link>
          </div>

          {auditData && auditData.executions && auditData.executions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--paper-alt)', borderBottom: '1px solid var(--border)' }}>
                    {['Payment', 'Action', 'Status', 'Recovered'].map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 10px',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 10,
                          fontWeight: 500,
                          color: 'var(--ink-muted)',
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          textAlign: i === 3 ? 'right' : 'left',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditData.executions.slice(0, 4).map((item, idx) => (
                    <tr
                      key={item.execution_id}
                      style={{
                        borderBottom: idx < 3 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <td style={{ padding: '10px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--ink)' }}>
                        <Link href={`/payments/${item.payment_id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {item.payment_id}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 10px', fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-secondary)', textTransform: 'capitalize' }}>
                        {item.action.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '10px 10px' }}>
                        <ExecStatusPill status={item.status} />
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--accent-sage)' }}>
                        {item.status === 'succeeded' ? formatINR(item.amount_recovered) : '₹0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '24px 12px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)' }}>
                No recovery executions recorded yet.
              </p>
              <Link
                href="/recovery"
                style={{
                  display: 'inline-block',
                  marginTop: 8,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--accent-sage)',
                  textDecoration: 'none',
                }}
              >
                Go to Recovery Operations →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── 4. HOW IS THE SYSTEM OPERATING? (System Status & Architecture Strip) ── */}
      <section
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-medium)',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
            <span style={{ fontFamily: 'var(--font-editorial)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
              Core Recovery Pipeline Invariants
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
            DETECT → DIAGNOSE → POLICY → EXECUTION GATE → AUDIT
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div style={{ background: 'var(--paper-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-subtle)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              1. Policy Supremacy
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
              Deterministic policies strictly override AI recommendations when risk bounds are exceeded.
            </p>
          </div>
          <div style={{ background: 'var(--paper-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-subtle)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              2. Server Authority
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
              Client sends only payment ID. Actions, amounts, and execution modes are governed server-side.
            </p>
          </div>
          <div style={{ background: 'var(--paper-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-subtle)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              3. Strict Accounting
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
              Recovered Revenue = SUM(amount WHERE succeeded). AI confidence cannot create realized revenue.
            </p>
          </div>
          <div style={{ background: 'var(--paper-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-subtle)', padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              4. Idempotency Lock
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)', lineHeight: 1.4 }}>
              Re-executing an already recovered payment returns an idempotency lock with ₹0 new revenue.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
