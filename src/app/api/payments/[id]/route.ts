import { NextRequest, NextResponse } from 'next/server';
import { getPaymentById } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve payment';
    console.error('Error fetching payment by id:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
