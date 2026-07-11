// app/api/cron/crypto-rate/route.ts
//
// Refreshes the MMK/USDT rate. Wire this to a Vercel Cron (see vercel.json).
// Protected by CRON_SECRET so it can't be spammed.

import { NextResponse } from 'next/server';
import { refreshRate, getLatestStoredRate } from '@/lib/cryptoRate';
import { sendTelegramMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');

  // Vercel Cron sends the secret as a Bearer token.
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await refreshRate();

  // Alert on trouble — a silently dead rate feed is how you end up quoting
  // a week-old price.
  if (!result.stored) {
    const last = await getLatestStoredRate();
    const ageHours = last
      ? Math.round((Date.now() - new Date(last.fetchedAt).getTime()) / 3600000)
      : null;

    if (result.reason === 'deviation_too_large') {
      await sendTelegramMessage({
        text: `⚠️ Crypto rate REJECTED (deviation too large)\nFetched: ${result.rate}\nKeeping last good rate.\nCheck the P2P feed.`,
      }).catch(() => {});
    } else if (ageHours !== null && ageHours >= 3) {
      await sendTelegramMessage({
        text: `⚠️ Crypto rate feed failing (${result.reason}).\nLast good rate is ${ageHours}h old.\nSet a manual rate in admin if this continues.`,
      }).catch(() => {});
    }
  }

  return NextResponse.json(result);
}
