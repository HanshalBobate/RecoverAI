import { NextRequest, NextResponse } from 'next/server';
import { getPaymentById } from '@/lib/db';
import { assessPayment } from '@/lib/recovery';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/[id]/decision
 *
 * Runs the deterministic Recovery Decision Engine against a single payment.
 * Returns the assessment (classification, diagnosis, recommended action, policy rule, stop condition).
 *
 * NOTE: This endpoint is strictly read-only and performs NO payment execution.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payment = getPaymentById(id);

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment with ID '${id}' not found`,
        },
        { status: 404 }
      );
    }

    const decision = assessPayment(payment);

    return NextResponse.json({
      success: true,
      data: decision,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to evaluate recovery decision';
    console.error('Error in recovery decision endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
