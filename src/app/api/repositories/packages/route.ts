import { NextResponse } from 'next/server';
import { getSnapshotPackages } from '@/lib/graph/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('repoId') || '';
    const snapshotId = searchParams.get('snapshotId');
    const search = searchParams.get('search') || '';

    if (!snapshotId) {
      return NextResponse.json(
        { error: 'snapshotId query parameter is required' },
        { status: 400 }
      );
    }

    const packages = await getSnapshotPackages(snapshotId, search);
    return NextResponse.json({ repoId, snapshotId, packages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to fetch packages', details: message },
      { status: 500 }
    );
  }
}
