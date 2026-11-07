// GET /api/panel/codes/<token> — allowed login emails for this customer link.
import { NextResponse } from 'next/server';
import { getLinkByToken, linkIsLive, recentAllowedEmails } from '@/lib/panel/data';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ipOf(req: Request) {
  return (
    req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export async function GET(req: Request, { params }: { params: { token: string } }) {
  const rl = await checkRateLimit({ key: ipOf(req), route: 'panel-codes', windowInSeconds: 600, maxRequests: 120 });
  if (!rl.allowed) return NextResponse.json({ error: 'Too many checks. Please wait a few minutes.' }, { status: 429 });

  const found = await getLinkByToken(params.token);
  if (!found || !linkIsLive(found.link) || found.account.status !== 'active') {
    return NextResponse.json({ error: 'This link has expired.' }, { status: 404 });
  }
  const mails = await recentAllowedEmails(found.account.id);
  return NextResponse.json(
    {
      messages: mails.map((m) => ({
        id: m.id,
        subject: m.subject || '',
        code: m.code,
        link: m.action_link,
        receivedAt: m.received_at,
        snippet: (m.text_body || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 280),
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
