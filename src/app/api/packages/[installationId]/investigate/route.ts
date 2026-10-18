import { NextResponse } from 'next/server';
import { investigatePackage } from '@/lib/graph/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ installationId: string }> }
) {
  try {
    const { installationId } = await params;
    const { searchParams } = new URL(request.url);
    const snapshotId = searchParams.get('snapshotId');

    if (!snapshotId) {
      return NextResponse.json(
        { error: 'snapshotId query parameter is required' },
        { status: 400 }
      );
    }

    const decodedInstallationId = decodeURIComponent(installationId);
    const result = await investigatePackage(snapshotId, decodedInstallationId);

    return NextResponse.json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Investigation failed', details: message },
      { status: 500 }
    );
  }
}
