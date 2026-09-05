'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Activity,
  Search,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  FileSpreadsheet,
  Zap,
} from 'lucide-react';
import { RecoveryExecutionRecord } from '@/lib/types';
import { MetricCard } from '@/components/MetricCard';
import { formatINR, formatDate } from '@/lib/format';

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

export default function AuditPage() {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchAuditData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/recovery/audit?limit=250');
      if (res.ok) {
        const j = await res.json();
        setAuditData(j.data);
      }
    } catch (err) {
      console.error('Failed to fetch audit data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  const filteredExecutions = useMemo(() => {
    if (!auditData?.executions) return [];
    return auditData.executions.filter((e) => {
      // Search query matches execution_id or payment_id
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = e.execution_id.toLowerCase().includes(q);
        const matchesPay = e.payment_id.toLowerCase().includes(q);
        if (!matchesId && !matchesPay) return false;
      }
      // Status filter
      if (statusFilter !== 'all' && e.status !== statusFilter) {
        return false;
      }
      // Action filter
      if (actionFilter !== 'all' && e.action !== actionFilter) {
        return false;
      }
      return true;
    });
  }, [auditData?.executions, searchQuery, statusFilter, actionFilter]);

  const metrics = auditData?.metrics ?? {
    executions_total: 0,
    successful_count: 0,
    failed_count: 0,
    blocked_count: 0,
    customer_action_count: 0,
    escalated_count: 0,
    no_action_count: 0,
    recovered_revenue: 0,
  };

  const hasFilter = searchQuery !== '' || statusFilter !== 'all' || actionFilter !== 'all';

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
        <div style={{ borderLeft: '3px solid var(--accent-sage)', paddingLeft: 14 }}>
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
            Audit Ledger & Governance
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)' }}>
            Immutable execution records, cryptographic traceability, and strict financial accounting invariants.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => fetchAuditData()}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-subtle)',
              padding: '6px 12px',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw style={{ width: 12, height: 12, animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
          <StatusPill color="var(--accent-sage)" bg="var(--accent-sage-light)">
            APPEND ONLY
          </StatusPill>
          <StatusPill color="var(--accent-lavender)" bg="var(--accent-lavender-light)">
            LOCAL SQLITE
          </StatusPill>
        </div>
      </div>

      {/* ── Summary Metrics ── */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <MetricCard
            title="Total Executions"
            value={String(metrics.executions_total)}
            subtext="All attempted recovery actions"
            icon={Activity}
            accentColor="slate"
          />
          <MetricCard
            title="Succeeded"
            value={String(metrics.successful_count)}
            subtext="Verified recovery payments"
            icon={CheckCircle2}
            accentColor="emerald"
            badgeText="Recovered"
          />
          <MetricCard
            title="Blocked"
            value={String(metrics.blocked_count)}
            subtext="Policy safety lockouts"
            icon={Lock}
            accentColor="amber"
            badgeText="Enforced"
          />
          <MetricCard
            title="Customer Action"
            value={String(metrics.customer_action_count)}
            subtext="Non-financial outreach triggered"
            icon={AlertTriangle}
            accentColor="slate"
          />
          <MetricCard
            title="Recovered Revenue"
            value={formatINR(metrics.recovered_revenue)}
            subtext="SUM(amount WHERE succeeded)"
            icon={CheckCircle2}
            accentColor="emerald"
            badgeText="Realized"
          />
        </div>
      </section>

      {/* ── Accounting Invariant Banner ── */}
      <section
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--accent-sage)',
          borderRadius: 'var(--radius-medium)',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 500px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <ShieldCheck style={{ width: 14, height: 14, color: 'var(--accent-sage)' }} />
              <span style={{ fontFamily: 'var(--font-editorial)', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                Deterministic Accounting Invariant
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
              Recovered Revenue is recognized <strong>exclusively</strong> upon verified recovery execution success. Algorithmic or LLM projections are categorized strictly as <em>Potentially Recoverable</em> and never booked as realized revenue. The first is an analytical estimate; the second is realized execution revenue verified by sequential transaction logs.
            </p>
          </div>

          <div
            style={{
              background: 'var(--paper-alt)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-subtle)',
              padding: '10px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--ink)',
              lineHeight: 1.6,
            }}
          >
            <div><strong>Recovered Revenue</strong> = SUM(amount_recovered WHERE status = &apos;succeeded&apos;)</div>
            <div style={{ color: 'var(--accent-clay)', marginTop: 2 }}><strong>Potentially Recoverable</strong> ≠ Recovered Revenue</div>
          </div>
        </div>
      </section>

      {/* ── Filters & Search ── */}
      <section
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-medium)',
          padding: '14px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            marginBottom: 12,
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
            <Search
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 13,
                height: 13,
                color: 'var(--ink-faint)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Search by execution ID or payment ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--ink)',
                background: 'var(--paper-alt)',
                border: '1px solid var(--border)',
                borderBottom: '2px solid var(--border-strong)',
                borderRadius: 'var(--radius-medium)',
                padding: '7px 28px 7px 30px',
                outline: 'none',
                transition: 'border-color 0.12s',
              }}
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = 'var(--accent-sage)'; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = 'var(--border-strong)'; }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--ink-muted)',
                  lineHeight: 1,
                  padding: 2,
                  fontSize: 14,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <SlidersHorizontal style={{ width: 11, height: 11, color: 'var(--ink-muted)', marginRight: 4, flexShrink: 0 }} />
            {(['all', 'succeeded', 'blocked', 'customer_action_required', 'failed'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: statusFilter === st ? 600 : 400,
                  color: statusFilter === st ? 'var(--ink)' : 'var(--ink-muted)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: statusFilter === st ? '2px solid var(--accent-sage)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  textTransform: 'capitalize',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
              >
                {st === 'all'
                  ? 'All Statuses'
                  : st === 'customer_action_required'
                  ? 'Customer Action'
                  : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              color: 'var(--ink-secondary)',
              background: 'var(--paper-alt)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-medium)',
              padding: '5px 10px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Actions</option>
            <option value="retry_payment">Retry Payment</option>
            <option value="contact_customer">Contact Customer</option>
            <option value="request_payment_method_update">Request Method Update</option>
            <option value="escalate_to_human">Escalate to Human</option>
            <option value="do_nothing">Do Nothing</option>
          </select>

          {hasFilter && (
            <button
              onClick={() => { setStatusFilter('all'); setActionFilter('all'); setSearchQuery(''); }}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: 'var(--accent-clay)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
              }}
            >
              Reset filters
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--ink-muted)' }}>
            {isLoading ? 'Loading ledger…' : (
              <>
                Showing{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--ink)' }}>
                  {filteredExecutions.length}
                </span>{' '}
                of {metrics.executions_total} records
              </>
            )}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--ink-faint)' }}>
            Click Payment ID to inspect full transaction lifecycle
          </span>
        </div>
      </section>

      {/* ── Ledger Table ── */}
      <section
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-medium)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-surface)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--paper-alt)', borderBottom: '1px solid var(--border)' }}>
                {['Timestamp', 'Execution ID', 'Payment ID', 'Action', 'Status', 'Policy Rule', 'Mode', 'Attempted', 'Recovered', ''].map((h, i) => (
                  <th
                    key={h || i}
                    style={{
                      padding: '10px 16px',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'var(--ink-muted)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      textAlign: i === 7 || i === 8 ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredExecutions.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-muted)' }}>
                      {isLoading ? 'Loading execution records…' : 'No execution records match the current filter.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredExecutions.map((item, rowIdx) => {
                  const isLast = rowIdx === filteredExecutions.length - 1;
                  return (
                    <tr
                      key={item.execution_id}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--paper-alt)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(item.created_at)}
                      </td>

                      {/* Execution ID */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}>
                        <span title={item.execution_id}>
                          {item.execution_id.slice(0, 14)}…
                        </span>
                      </td>

                      {/* Payment ID */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500 }}>
                        <Link
                          href={`/payments/${item.payment_id}`}
                          style={{
                            color: 'var(--ink)',
                            textDecoration: 'none',
                            borderBottom: '1px dotted var(--ink-muted)',
                          }}
                        >
                          {item.payment_id}
                        </Link>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                        {item.action.replace(/_/g, ' ')}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <ExecStatusPill status={item.status} />
                      </td>

                      {/* Policy Rule */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {item.policy_rule || 'POL-DEFAULT'}
                      </td>

                      {/* Mode */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--ink-secondary)',
                            background: 'var(--paper-alt)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-subtle)',
                            padding: '2px 6px',
                          }}
                        >
                          {item.execution_mode === 'razorpay_test' ? 'Razorpay Test' : 'Mock Test'}
                        </span>
                      </td>

                      {/* Attempted */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'right', color: 'var(--ink-secondary)', whiteSpace: 'nowrap' }}>
                        {formatINR(item.amount_attempted)}
                      </td>

                      {/* Recovered */}
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, textAlign: 'right', color: item.status === 'succeeded' ? 'var(--accent-sage)' : 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                        {item.status === 'succeeded' ? formatINR(item.amount_recovered) : '₹0'}
                      </td>

                      {/* Inspect Link */}
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Link
                          href={`/payments/${item.payment_id}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            fontFamily: 'var(--font-sans)',
                            fontSize: 11,
                            color: 'var(--ink-muted)',
                            textDecoration: 'none',
                            padding: '3px 8px',
                            borderRadius: 'var(--radius-subtle)',
                          }}
                        >
                          Inspect
                          <ChevronRight style={{ width: 12, height: 12 }} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
