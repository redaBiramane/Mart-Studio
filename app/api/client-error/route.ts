import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Reçoit les erreurs client et les journalise (visibles dans les logs Vercel).
// Point de branchement idéal pour Sentry / Logtail : remplacer le console.error.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { message, stack, url, kind } = body || {};
    console.error('[client-error]', JSON.stringify({
      kind: kind || 'error',
      message: String(message || '').slice(0, 1000),
      url: String(url || '').slice(0, 300),
      stack: String(stack || '').slice(0, 2000),
      ua: req.headers.get('user-agent')?.slice(0, 200),
      at: new Date().toISOString(),
    }));
  } catch {
    /* ne jamais faire échouer le logging */
  }
  return NextResponse.json({ ok: true });
}
