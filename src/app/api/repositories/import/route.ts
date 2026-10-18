import { NextResponse } from 'next/server';
import { importRepository } from '@/lib/ingestion/pipeline';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, portfolioId } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'A valid GitHub repository URL is required.' },
        { status: 400 }
      );
    }

    const result = await importRepository(url, portfolioId || 'default');
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API Import Error]', message);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
