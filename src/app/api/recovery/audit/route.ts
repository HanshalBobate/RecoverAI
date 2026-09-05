import { NextRequest, NextResponse } from 'next/server';
import { getAllRecoveryExecutions, getExecutionMetrics } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/recovery/audit
 *
 * Retrieves persistent recovery execution audit records and execution summary metrics.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const executions = getAllRecoveryExecutions(limit);
    const metrics = getExecutionMetrics();

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        executions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve recovery audit records';
    console.error('Error in recovery audit endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
