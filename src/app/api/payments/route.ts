import { NextRequest, NextResponse } from 'next/server';
import { getPayments } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const failure_reason = searchParams.get('failure_reason') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 250;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const { payments, total } = getPayments({
      status,
      failure_reason,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      data: payments,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve payments';
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
