// app/api/cron/telegram-reminder/route.ts
// Called by Vercel Cron to send a Telegram reminder for PENDING TOP-UPS only.
// ──────────────────────────────────────────────────────────
// • Only sends between 8:00 AM – 10:00 PM Myanmar time (UTC+6:30)
// • Does NOT remind about manual orders (those can take hours)
// • Protect with CRON_SECRET so only your scheduler can call it.

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { notifyPendingSummary } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Check if current time is between 8:00 AM and 10:00 PM in Myanmar (UTC+6:30) */
function isWithinMyanmarActiveHours(): boolean {
  const now = new Date();

  // Myanmar is UTC+6:30 → add 6 hours 30 minutes to UTC
  const myanmarOffsetMs = (6 * 60 + 30) * 60 * 1000;
  const myanmarTime = new Date(now.getTime() + myanmarOffsetMs);

  const hour = myanmarTime.getUTCHours();
  const minute = myanmarTime.getUTCMinutes();

  // 8:00 AM (480 min) to 10:00 PM (1320 min)
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 480 && totalMinutes < 1320;
}

export async function GET(req: Request) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret) {
    const auth = req.headers.get('authorization') || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Skip if outside 8 AM – 10 PM Myanmar time
  if (!isWithinMyanmarActiveHours()) {
    return NextResponse.json({
      message: 'Outside active hours (8 AM – 10 PM MMT), skipping',
    });
  }

  const supabase = getServiceSupabaseClient();

  try {
    // Only check pending top-ups (not manual orders)
    const { data: topups } = await supabase
      .from('topups')
      .select('id')
      .eq('status', 'PENDING');

    const pendingTopups = ((topups ?? []) as any[]).length;

    if (pendingTopups === 0) {
      return NextResponse.json({ message: 'No pending top-ups, no notification sent' });
    }

    // Send reminder for top-ups only (manual orders = 0 so they won't show)
    const sent = await notifyPendingSummary({
      pendingTopups,
      pendingManualOrders: 0,
    });

    return NextResponse.json({
      sent,
      pendingTopups,
    });
  } catch (err: any) {
    console.error('[cron/telegram-reminder] error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
