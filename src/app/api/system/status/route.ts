import { NextResponse } from 'next/server';
import { getSystemStatus } from '@/lib/graph/queries';

export async function GET() {
  try {
    const status = await getSystemStatus();
    return NextResponse.json(status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to retrieve system status', details: message },
      { status: 500 }
    );
  }
}
