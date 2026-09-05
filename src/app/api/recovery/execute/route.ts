import { NextRequest, NextResponse } from 'next/server';
import { executeRecoveryForPayment, ExecutionMode } from '@/lib/execution';

export const dynamic = 'force-dynamic';

/**
 * POST /api/recovery/execute
 *
 * Executes a policy-approved recovery action for a single payment.
 *
 * CRITICAL DEFENSE IN DEPTH:
 * - Request payload specifies ONLY `payment_id`.
 * - The server evaluates the current AI recommendation and policy rules.
 * - The server decides what action is permitted; the client cannot select or modify actions.
 * - Execution Gate enforces retry limits, stopping rules, and idempotency.
 */
export async function POST(request: NextRequest) {
  try {
    let body: { payment_id?: string; mode?: ExecutionMode } | null = null;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON request body. Expected { payment_id: string }.',
        },
        { status: 400 }
      );
    }

    if (!body?.payment_id || typeof body.payment_id !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter 'payment_id'.",
        },
        { status: 400 }
      );
    }

    const result = await executeRecoveryForPayment(body.payment_id, body.mode);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to execute recovery';
    console.error('Error in recovery execution endpoint:', error);
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
