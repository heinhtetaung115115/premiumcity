// app/api/cron/vpn-daily/route.ts
// Daily VPN upkeep: sync data usage, delete expired keys, start a fresh
// 30-day data period for multi-month plans, and remind admin on Telegram
// when a server's paid month is ending or a server is down.

import { NextResponse } from 'next/server';
import { runDailyMaintenance } from '@/lib/vpn';

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
    const stats = await runDailyMaintenance();
    return NextResponse.json({ ok: true, ...stats });
  } catch (e: any) {
    console.error('[cron/vpn-daily] failed:', e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
