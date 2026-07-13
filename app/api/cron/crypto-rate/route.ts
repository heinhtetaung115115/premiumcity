// app/api/cron/crypto-rate/route.ts
//
// Hourly: store the Bybit SELL rate as a FALLBACK.
//
// SILENT ON FAILURE — no Telegram alert. You asked for exactly one
// notification a day (the 9 AM reminder), and a failed fetch here is not an
// emergency: your MANUAL rate is what prices top-ups. The 9 AM message
// reports feed health.

import { NextResponse } from 'next/server';
import { refreshCryptoRate } from '@/lib/cryptoRate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');

  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await refreshCryptoRate();

  // Log only. Never Telegram from here.
  if (!result.ok) {
    console.error('[cron/crypto-rate]', result.message);
  }

  return NextResponse.json(result);
}
