import { NextRequest, NextResponse } from 'next/server';
import { executeRecoveryBatch, ExecutionMode } from '@/lib/execution';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recovery/execute-batch
 *
 * Runs bounded batch recovery executions across at-risk payments.
 * Sequential execution prevents race conditions and strictly guarantees idempotency.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { payment_ids?: string[]; mode?: ExecutionMode } | null = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const paymentIds = body?.payment_ids;
    const mode = body?.mode;

    const result = await executeRecoveryBatch(paymentIds, mode);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute batch recovery';
    console.error('Error in batch recovery execution endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
