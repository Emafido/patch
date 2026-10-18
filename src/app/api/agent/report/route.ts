import { NextResponse } from 'next/server';
import { runInvestigationAgent } from '@/lib/agent/investigator';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId') || 'default';
    const question = searchParams.get('question') || 'Which shared dependency vulnerability should we investigate first, why is it present in these repositories, and what should we do about it?';

    const result = await runInvestigationAgent(portfolioId, question);

    return new NextResponse(result.report, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="patch-remediation-report.md"'
      }
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(`# Remediation Report Generation Failed\n\nError: ${message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8'
      }
    });
  }
}
