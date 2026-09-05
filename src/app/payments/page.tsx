'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, RotateCcw, AlertCircle } from 'lucide-react';
import { PaymentRecord } from '@/lib/types';
import { PaymentsTable } from '@/components/PaymentsTable';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [failureFilter, setFailureFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [total, setTotal] = useState(0);

  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (failureFilter !== 'all') params.set('failure_reason', failureFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve payments ledger from database');
      }
      const j = await res.json();
      setPayments(j.data || []);
      setTotal(j.total ?? j.data?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching payments');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, failureFilter, searchQuery]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const hasFilter = statusFilter !== 'all' || failureFilter !== 'all' || searchQuery !== '';

  return (
    <div
      style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
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
            Payments Investigation Workspace
          </h1>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-muted)' }}>
            Investigate failed, abandoned, and at-risk payments. Click any row to examine its diagnostic lifecycle.
          </p>
        </div>

        {error && (
          <button
            onClick={fetchPayments}
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
            Retry
          </button>
        )}
      </div>

      {/* ── Search & Filters ── */}
      <div
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
              placeholder="Search customer name, email, or payment ID…"
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
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderBottomColor = 'var(--accent-clay)'; }}
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
                aria-label="Clear search query"
              >
                ×
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <SlidersHorizontal style={{ width: 11, height: 11, color: 'var(--ink-muted)', marginRight: 4, flexShrink: 0 }} />
            {(['all', 'failed', 'abandoned', 'pending', 'successful'] as const).map((st) => (
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
                  borderBottom: statusFilter === st ? '2px solid var(--accent-clay)' : '2px solid transparent',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  textTransform: 'capitalize',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (statusFilter !== st) (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
                }}
                onMouseLeave={(e) => {
                  if (statusFilter !== st) (e.currentTarget as HTMLElement).style.color = 'var(--ink-muted)';
                }}
              >
                {st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>

          {/* Failure Reason */}
          <select
            value={failureFilter}
            onChange={(e) => setFailureFilter(e.target.value)}
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
            aria-label="Filter by failure reason"
          >
            <option value="all">All Failure Reasons</option>
            <option value="insufficient_funds">Insufficient Funds</option>
            <option value="bank_decline">Bank Decline</option>
            <option value="expired_card">Expired Card</option>
            <option value="timeout">Gateway Timeout</option>
            <option value="authentication_failure">3DS / Auth Failure</option>
            <option value="gateway_error">Gateway Error</option>
            <option value="checkout_abandoned">Checkout Abandoned</option>
          </select>

          {hasFilter && (
            <button
              onClick={() => { setStatusFilter('all'); setFailureFilter('all'); setSearchQuery(''); }}
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: 'var(--accent-clay)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                textDecoration: 'underline',
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
            {isLoading ? 'Loading records…' : (
              <>
                Showing{' '}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink)' }}>{payments.length}</span>
                {' '}transactions
                {statusFilter !== 'all' && <> · status: <span style={{ fontWeight: 500, color: 'var(--accent-clay)' }}>{statusFilter}</span></>}
                {failureFilter !== 'all' && <> · reason: <span style={{ fontWeight: 500, color: 'var(--accent-clay)' }}>{failureFilter}</span></>}
              </>
            )}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--ink-faint)' }}>
            Click any row to inspect complete recovery pipeline
          </span>
        </div>
      </div>

      {/* ── Table ── */}
      <PaymentsTable payments={payments} isLoading={isLoading} />
    </div>
  );
}
