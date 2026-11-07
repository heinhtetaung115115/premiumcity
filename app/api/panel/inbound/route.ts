// POST /api/panel/inbound — called by the Cloudflare Email Worker with the raw
// email for codes@pcity.online. Protected by a shared secret.
import { NextResponse } from 'next/server';
import { ingestEmail } from '@/lib/panel/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.PANEL_INBOUND_SECRET || '';
  if (!secret || req.headers.get('x-panel-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const raw = await req.text();
  if (!raw || raw.length > 3_000_000) {
    return NextResponse.json({ error: 'empty or too large' }, { status: 413 });
  }
  try {
    const res = await ingestEmail(raw, req.headers.get('x-envelope-to'), req.headers.get('x-envelope-from'));
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    console.error('[panel/inbound] failed:', e);
    return NextResponse.json({ error: e?.message ?? 'failed' }, { status: 500 });
  }
}
