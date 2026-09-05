import { NextRequest, NextResponse } from 'next/server';
import { getPaymentById } from '@/lib/db';
import { assessPaymentWithAI } from '@/lib/llm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/[id]/ai-assessment
 *
 * Invokes the LLM reasoning agent on an at-risk payment, validates the output,
 * passes the recommendation through the deterministic policy safety boundary,
 * and returns the combined AI Recommendation, Policy Validation, and Final Decision audit.
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

    const audit = await assessPaymentWithAI(payment);

    return NextResponse.json({
      success: true,
      data: audit,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate AI assessment';
    console.error('Error in AI assessment endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
