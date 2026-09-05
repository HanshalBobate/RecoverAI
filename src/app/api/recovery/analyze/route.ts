import { NextRequest, NextResponse } from 'next/server';
import { getAtRiskPayments, getPayments, getPaymentById } from '@/lib/db';
import { analyzeBatch } from '@/lib/recovery';
import { PaymentRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recovery/analyze
 *
 * Runs the deterministic Recovery Decision Engine across at-risk payments.
 * Returns batch-level telemetry, action distributions, and estimated salvageable revenue.
 *
 * NOTE ON FINANCIAL REPORTING:
 * `potentially_recoverable_value` is an algorithmic model estimate.
 * Under no circumstances is this labeled or treated as recovered revenue.
 * No payment execution is performed in Phase 2.
 */
export async function POST(request: NextRequest) {
  try {
    let payments: PaymentRecord[] = [];

    // Optional request payload to specify payments to analyze
    let body: { payment_ids?: string[]; include_all?: boolean } | null = null;
    try {
      body = await request.json();
    } catch {
      // Empty body is permissible; defaults to all at-risk records
      body = null;
    }

    if (body?.payment_ids && Array.isArray(body.payment_ids) && body.payment_ids.length > 0) {
      const records: PaymentRecord[] = [];
      for (const id of body.payment_ids) {
        const p = getPaymentById(id);
        if (p) records.push(p);
      }
      payments = records;
    } else if (body?.include_all) {
      const res = getPayments({ limit: 500 });
      payments = res.payments;
    } else {
      // Default: analyze all failed and abandoned checkout records
      payments = getAtRiskPayments();
    }

    const { metrics, decisions } = analyzeBatch(payments);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        decisions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute recovery analysis';
    console.error('Error in batch recovery analysis endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recovery/analyze
 * Convenience handler for query-based risk analysis.
 */
export async function GET() {
  try {
    const payments = getAtRiskPayments();
    const { metrics, decisions } = analyzeBatch(payments);

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        decisions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute recovery analysis';
    console.error('Error in batch recovery analysis endpoint (GET):', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
