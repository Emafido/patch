import { NextResponse } from 'next/server';
import { listRepositories } from '@/lib/graph/queries';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId') || 'default';
    const repositories = await listRepositories(portfolioId);
    return NextResponse.json({ repositories });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to list repositories', details: message },
      { status: 500 }
    );
  }
}
