'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PaymentRecord } from '@/lib/types';
import { formatINR, formatFailureReason, formatDate } from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { ChevronRight, CreditCard, Smartphone, Globe, AlertCircle } from 'lucide-react';

interface PaymentsTableProps {
  payments: PaymentRecord[];
  isLoading?: boolean;
}

export function PaymentsTable({
  payments,
  isLoading = false,
}: PaymentsTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-medium)',
          padding: '56px 24px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-surface)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid var(--accent-clay)',
            borderTopColor: 'transparent',
          }}
          className="animate-spin"
        />
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--ink-secondary)', fontFamily: 'var(--font-sans)' }}>
          Loading payments ledger…
        </p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-medium)',
          padding: '56px 24px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-surface)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--accent-clay-light)',
            color: 'var(--accent-clay)',
            margin: '0 auto 12px',
          }}
        >
          <AlertCircle style={{ width: 20, height: 20 }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
          No payment records match the current criteria
        </p>
        <p style={{ marginTop: 4, fontSize: 12, color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)' }}>
          Try clearing search filters or changing status tabs.
        </p>
      </div>
    );
  }

  const getMethodIcon = (type: string) => {
    switch (type) {
      case 'upi':
        return <Smartphone style={{ width: 12, height: 12, color: 'var(--accent-sage)' }} />;
      case 'netbanking':
        return <Globe style={{ width: 12, height: 12, color: 'var(--accent-sky)' }} />;
      default:
        return <CreditCard style={{ width: 12, height: 12, color: 'var(--accent-lavender)' }} />;
    }
  };

  return (
    <div
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
          {/* Table Head */}
          <thead>
            <tr
              style={{
                background: 'var(--paper-alt)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {['Customer', 'Payment ID', 'Amount', 'Status', 'Failure Reason', 'Attempts', 'Last Attempt', ''].map((h, i) => (
                <th
                  key={h || i}
                  scope="col"
                  style={{
                    padding: '10px 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: '10px',
                    fontWeight: 500,
                    color: 'var(--ink-muted)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    textAlign: i === 2 ? 'right' : i === 3 ? 'center' : i === 5 ? 'center' : 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h || <span className="sr-only">Inspect Action</span>}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {payments.map((p, rowIdx) => {
              const isAtRisk = p.status === 'failed' || p.status === 'abandoned';
              const isLast = rowIdx === payments.length - 1;
              return (
                <tr
                  key={p.payment_id}
                  tabIndex={0}
                  role="link"
                  aria-label={`Inspect payment ${p.payment_id} for ${p.customer_name}, amount ${formatINR(p.amount)}, status ${p.status}`}
                  onClick={() => router.push(`/payments/${p.payment_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      router.push(`/payments/${p.payment_id}`);
                    }
                  }}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--paper-alt)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {/* Customer */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          background: 'var(--paper-fold)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontFamily: 'var(--font-editorial)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--ink-secondary)',
                          flexShrink: 0,
                          lineHeight: 1,
                        }}
                      >
                        {p.customer_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--font-sans)',
                            fontSize: 13,
                            fontWeight: 500,
                            color: 'var(--ink)',
                            lineHeight: 1.3,
                          }}
                        >
                          {p.customer_name}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--ink-muted)',
                            marginTop: 1,
                          }}
                        >
                          {p.customer_email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Payment ID & Method */}
                  <td style={{ padding: '12px 16px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--ink-secondary)',
                        lineHeight: 1.3,
                      }}
                    >
                      {p.payment_id}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 3,
                        fontFamily: 'var(--font-sans)',
                        fontSize: 10,
                        color: 'var(--ink-muted)',
                      }}
                    >
                      {getMethodIcon(p.payment_method_type)}
                      <span style={{ maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.payment_method_detail || p.payment_method_type.toUpperCase()}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: isAtRisk ? 'var(--accent-clay)' : 'var(--ink)',
                        lineHeight: 1.3,
                      }}
                    >
                      {formatINR(p.amount)}
                    </div>
                    <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--ink-muted)', marginTop: 1 }}>
                      {p.currency}
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <StatusBadge status={p.status} />
                  </td>

                  {/* Failure Reason */}
                  <td style={{ padding: '12px 16px' }}>
                    {p.failure_reason ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'var(--font-sans)',
                          fontSize: 12,
                          fontWeight: 400,
                          color: 'var(--ink-secondary)',
                        }}
                      >
                        <span
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-clay)',
                            flexShrink: 0,
                          }}
                        />
                        {formatFailureReason(p.failure_reason)}
                      </span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                        None
                      </span>
                    )}
                  </td>

                  {/* Attempts */}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 400,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-subtle)',
                        background: p.attempt_count > 1 ? 'var(--accent-clay-light)' : 'var(--paper-alt)',
                        color: p.attempt_count > 1 ? 'var(--accent-clay)' : 'var(--ink-secondary)',
                        borderLeft: p.attempt_count > 1 ? '2px solid var(--accent-clay)' : '2px solid var(--border)',
                      }}
                    >
                      {p.attempt_count} {p.attempt_count === 1 ? 'try' : 'tries'}
                    </span>
                  </td>

                  {/* Last Attempt */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--ink-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(p.last_attempt_at)}
                  </td>

                  {/* Inspect link */}
                  <td style={{ padding: '12px 12px 12px 8px', textAlign: 'right' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'var(--ink-muted)',
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-subtle)',
                        background: 'var(--paper-alt)',
                        border: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Inspect
                      <ChevronRight style={{ width: 12, height: 12 }} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
