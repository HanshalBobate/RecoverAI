import { NextRequest, NextResponse } from 'next/server';
import { getAtRiskPayments, getPayments, getPaymentById } from '@/lib/db';
import { analyzeAIBatch, LLMProviderType } from '@/lib/llm';
import { PaymentRecord } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recovery/ai-analyze
 *
 * Runs batch AI reasoning & deterministic policy validation across at-risk payments.
 * Telemetry captures AI proposal distributions, policy overrides, and fallback events.
 *
 * FINANCIAL ACCURACY INVARIANT:
 * `recovered_revenue` is strictly 0.
 * `potentially_recoverable_value` is an algorithmic / model estimate.
 * Zero payments are executed in Phase 3.
 */
export async function POST(request: NextRequest) {
  try {
    let payments: PaymentRecord[] = [];
    let providerOverride: LLMProviderType | undefined = undefined;

    let body: { payment_ids?: string[]; include_all?: boolean; provider?: LLMProviderType } | null = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    if (body?.provider) {
      providerOverride = body.provider;
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
      payments = getAtRiskPayments();
    }

    const batchResult = await analyzeAIBatch(payments, providerOverride);

    return NextResponse.json({
      success: true,
      data: batchResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute batch AI analysis';
    console.error('Error in batch AI recovery analysis endpoint:', error);
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
 * GET /api/recovery/ai-analyze
 * Convenience handler for query-based batch AI triage.
 */
export async function GET() {
  try {
    const payments = getAtRiskPayments();
    const batchResult = await analyzeAIBatch(payments);

    return NextResponse.json({
      success: true,
      data: batchResult,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute batch AI analysis (GET)';
    console.error('Error in batch AI recovery analysis endpoint (GET):', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
