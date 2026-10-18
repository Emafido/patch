import { NextResponse } from 'next/server';
import { investigatePackage } from '@/lib/graph/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const installationId = searchParams.get('installationId');
    const snapshotId = searchParams.get('snapshotId');

    if (!installationId || !snapshotId) {
      return NextResponse.json(
        { error: 'Both installationId and snapshotId query parameters are required' },
        { status: 400 }
      );
    }

    const result = await investigatePackage(snapshotId, installationId);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Investigation failed', details: message },
      { status: 500 }
    );
  }
}
