// app/api/cron/rate-reminder/route.ts
//
// The ONE daily notification: 09:00 Asia/Yangon.
//
// Your manual rate prices every crypto top-up and must be refreshed daily.
// This message carries the live Bybit reference rates with it, so you can
// decide straight from Telegram without opening the dashboard.
//
// Schedule (vercel.json): "30 2 * * *"  ->  02:30 UTC = 09:00 Yangon (UTC+6:30)

import { NextResponse } from 'next/server';
import { probeReferenceRates, getRateSettings } from '@/lib/cryptoRate';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_HOURS = 24;

const fmt = (n: number | null) => (n ? n.toLocaleString('en-US') : '—');

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');

  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const settings = await getRateSettings();
  const pairs = await probeReferenceRates(settings.payTypes);

  const ageHours = settings.updatedAt
    ? (Date.now() - new Date(settings.updatedAt).getTime()) / 3_600_000
    : Infinity;

  const isOverdue = !settings.manualEnabled || ageHours > STALE_HOURS;

  const lines = pairs
    .map((p) => {
      const sell = p.sell.ok ? `${fmt(p.sell.rate)} Ks` : `❌ ${p.sell.detail}`;
      const buy = p.buy.ok ? `${fmt(p.buy.rate)} Ks` : '—';
      return `<b>${p.source}</b>\n   SELL: ${sell}\n   BUY:  ${buy}`;
    })
    .join('\n\n');

  const header = isOverdue
    ? "🔴 <b>ACTION NEEDED — set today's crypto rate</b>"
    : '🌅 <b>Daily crypto rate check</b>';

  const current =
    settings.manualEnabled && settings.manualUsdtMmk
      ? `Current rate: <b>${fmt(settings.manualUsdtMmk)} Ks</b> per USDT\n` +
        (ageHours > STALE_HOURS
          ? `⚠️ Set ${Math.floor(ageHours)}h ago — <b>OVERDUE</b>`
          : `✅ Set ${Math.floor(ageHours)}h ago`)
      : '⚠️ <b>No manual rate set.</b> Crypto top-ups are on the auto feed, or disabled.';

  const filter =
    settings.payTypes.length > 0
      ? '\n\n✅ Filtered to your cash-out payment method.'
      : '\n\n⚠️ No payment-method filter — these blend ALL methods (KBZ Pay, bank, Wave), so they match none of them exactly.';

  try {
    await sendTelegramMessage({
      text:
        `${header}\n\n` +
        `${current}\n\n` +
        `<b>Bybit reference (SELL = what a merchant pays you):</b>\n\n` +
        `${lines}` +
        `${filter}\n\n` +
        `👉 /admin/crypto-rate`,
    });
  } catch (err) {
    console.error('[cron/rate-reminder] telegram failed:', err);
    return NextResponse.json({ ok: false, error: 'telegram failed' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    isOverdue,
    ageHours: Number.isFinite(ageHours) ? Math.floor(ageHours) : null,
  });
}
