import React from 'react';
import Link from 'next/link';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { getPaymentById } from '@/lib/db';
import { PaymentDetailClient } from './PaymentDetailClient';

export const dynamic = 'force-dynamic';

export default async function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const payment = getPaymentById(id);

  if (!payment) {
    return (
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'var(--accent-clay-light)',
            color: 'var(--accent-clay)',
            marginBottom: 16,
          }}
        >
          <AlertCircle style={{ width: 24, height: 24 }} />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-editorial)',
            fontSize: 24,
            fontWeight: 500,
            color: 'var(--ink)',
            letterSpacing: '-0.02em',
          }}
        >
          Payment Not Found
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--ink-muted)',
            marginTop: 8,
          }}
        >
          No payment record found with ID <code style={{ fontFamily: 'var(--font-mono)' }}>{id}</code>.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            href="/payments"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'var(--paper)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-medium)',
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--ink)',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-surface)',
            }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Back to Payments
          </Link>
        </div>
      </div>
    );
  }

  return <PaymentDetailClient payment={{ ...payment }} />;
}
