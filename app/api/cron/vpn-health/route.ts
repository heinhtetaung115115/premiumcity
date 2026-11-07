// app/api/cron/vpn-health/route.ts
// Every 5 minutes: ping VPN servers, alert on Telegram after 2 failed checks
// (with a one-tap "Move all to backup" button), save usage hourly, and keep
// any queued move running.

import { NextResponse } from 'next/server';
import { runHealthChecks } from '@/lib/vpn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const stats = await runHealthChecks();
    return NextResponse.json({ ok: true, ...stats });
  } catch (e: any) {
    console.error('[cron/vpn-health] failed:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
