// app/api/cron/crypto-rate/route.ts
//
// Refreshes the MMK/USDT rate (SELL side). Wired to Vercel Cron.
// On failure, Telegram gets the EXACT per-source reason, so a geo-block
// (HTTP 451) is distinguishable from a changed API shape without digging
// through logs.

import { NextResponse } from 'next/server';
import { refreshCryptoRate } from '@/lib/cryptoRate';
import { sendTelegramMessage } from '@/lib/telegram';

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

  if (!result.ok) {
    const lines = result.probes
      .map((p) => `• <b>${p.source}</b>: ${p.ok ? 'OK' : 'FAILED'} — ${p.detail}`)
      .join('\n');

    try {
      await sendTelegramMessage({
        text:
          `⚠️ <b>Crypto rate not updated</b>\n\n` +
          `${result.message}\n\n` +
          `<b>Sources (SELL side):</b>\n${lines}\n\n` +
          `Set a manual rate at /admin/crypto-rate if this persists.`,
      });
    } catch (err) {
      console.error('[cron/crypto-rate] telegram failed:', err);
    }
  }

  return NextResponse.json(result);
}
