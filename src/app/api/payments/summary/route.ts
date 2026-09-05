import { NextResponse } from 'next/server';
import { getPaymentsSummary } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = getPaymentsSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate payment summary';
    console.error('Error calculating payment summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
