import { NextRequest, NextResponse } from 'next/server';
import { getExecutionPreview } from '@/lib/execution';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/[id]/execution-preview
 *
 * Generates an Execution Preview for a given payment without mutating state.
 * Returns proposed action, policy status, eligibility, execution mode,
 * amounts, stop condition, and prior executions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const preview = await getExecutionPreview(id);

    if (!preview) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment with ID '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate execution preview';
    console.error('Error in execution preview endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
