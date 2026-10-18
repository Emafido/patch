import { NextResponse } from 'next/server';
import { runInvestigationAgent } from '@/lib/agent/investigator';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const portfolioId = body.portfolioId || 'default';
    const question = body.question || 'Which shared dependency vulnerability should we investigate first, why is it present in these repositories, and what should we do about it?';

    const result = await runInvestigationAgent(portfolioId, question);
    return NextResponse.json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API Agent Investigation Error]', message);
    return NextResponse.json(
      { error: 'Agent investigation failed', details: message },
      { status: 500 }
    );
  }
}
