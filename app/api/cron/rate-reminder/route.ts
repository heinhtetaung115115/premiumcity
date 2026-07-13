// app/api/cron/rate-reminder/route.ts
//
// Daily 09:00 Asia/Yangon reminder to set the manual MMK/USDT rate.
//
// The manual rate is what actually prices crypto top-ups, so it MUST be
// refreshed daily. This message carries the live Binance + Bybit reference
// rates with it, so you can decide straight from Telegram without opening
// the dashboard.
//
// Schedule (vercel.json): "30 2 * * *"  ->  02:30 UTC = 09:00 Yangon (UTC+6:30)

import { NextResponse } from 'next/server';
import { probeReferenceRates, getRateSettings } from '@/lib/cryptoRate';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_HOURS = 24;

function fmt(n: number | null) {
  return n ? n.toLocaleString('en-US') : '—';
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');

  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const settings = await getRateSettings();
  const pairs = await probeReferenceRates(settings.payTypes);

  // How stale is the manual rate?
  const ageHours = settings.updatedAt
    ? (Date.now() - new Date(settings.updatedAt).getTime()) / 3_600_000
    : Infinity;

  const isOverdue = !settings.manualEnabled || ageHours > STALE_HOURS;

  const lines = pairs
    .map((p) => {
      const sell = p.sell.ok ? fmt(p.sell.rate) : `❌ ${p.sell.detail}`;
      const buy = p.buy.ok ? fmt(p.buy.rate) : '—';
      return `<b>${p.source}</b>\n   SELL: ${sell} Ks\n   BUY:  ${buy} Ks`;
    })
    .join('\n\n');

  const header = isOverdue
    ? '🔴 <b>ACTION NEEDED — set today\u2019s crypto rate</b>'
    : '🌅 <b>Daily crypto rate check</b>';

  const current = settings.manualEnabled && settings.manualUsdtMmk
    ? `Current manual rate: <b>${fmt(settings.manualUsdtMmk)} Ks</b> per USDT` +
      (ageHours > STALE_HOURS
        ? `\n⚠️ Set ${Math.floor(ageHours)}h ago — <b>OVERDUE</b>`
        : `\n✅ Set ${Math.floor(ageHours)}h ago`)
    : '⚠️ <b>No manual rate is set.</b> Crypto top-ups are running on the auto feed (or disabled).';

  const filter =
    settings.payTypes.length > 0
      ? `\n\nPayment method filter: ${settings.payTypes.join(', ')}`
      : '\n\n⚠️ No payment-method filter set — these are blended across ALL methods.';

  try {
    await sendTelegramMessage({
      text:
        `${header}\n\n` +
        `${current}\n\n` +
        `<b>Reference rates (SELL = what a merchant pays you):</b>\n\n` +
        `${lines}` +
        `${filter}\n\n` +
        `👉 Set it: /admin/crypto-rate`,
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
