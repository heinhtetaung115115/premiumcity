// app/api/cron/netflix-expiry/route.ts
// Daily: email customers ~3 days before their Netflix account expires.
//
// We read each account's endDate LIVE from the supplier link (that's the
// source of truth), and send at most one reminder per expiry date per item —
// tracked in netflix_expiry_reminders so we never spam.

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { fetchNetflixPanel } from '@/lib/netflix';
import { sendEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REMIND_DAYS_BEFORE = 3;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const auth = req.headers.get('authorization') || '';
  const provided = auth.replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = getServiceSupabaseClient();

  // Netflix panel deliveries.
  const { data: invs } = await supabase
    .from('inventory_items')
    .select('order_item_id,payload')
    .limit(1000);

  const netflixItems = ((invs ?? []) as any[]).filter(
    (r) => r?.payload?.type === 'netflix_panel' && r?.payload?.link && r?.order_item_id
  );

  let sent = 0;
  let checked = 0;

  for (const inv of netflixItems) {
    checked++;
    try {
      const panel = await fetchNetflixPanel(String(inv.payload.link));
      const endDate = panel.ok ? panel.profile?.endDate ?? null : null;
      if (!endDate) continue;

      const end = new Date(endDate + 'T00:00:00');
      if (Number.isNaN(end.getTime())) continue;

      const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
      if (daysLeft !== REMIND_DAYS_BEFORE) continue; // only fire on the 3-days mark

      // Already reminded for THIS expiry date?
      const { data: already } = await supabase
        .from('netflix_expiry_reminders')
        .select('id')
        .eq('order_item_id', inv.order_item_id)
        .eq('end_date', endDate)
        .maybeSingle();
      if (already) continue;

      // Who to email.
      const { data: item } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('id', inv.order_item_id)
        .maybeSingle();
      if (!item) continue;

      const { data: order } = await supabase
        .from('orders')
        .select('user_id')
        .eq('id', (item as any).order_id)
        .maybeSingle();
      if (!order) continue;

      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', (order as any).user_id)
        .maybeSingle();
      const email = (user as any)?.email;
      if (!email) continue;

      await sendEmail({
        to: email,
        subject: `Your Netflix subscription expires in ${REMIND_DAYS_BEFORE} days`,
        html:
          `<p>Hello,</p>` +
          `<p>Your Netflix account will expire on <b>${endDate}</b> — that's in ${REMIND_DAYS_BEFORE} days.</p>` +
          `<p>To keep it active, open your order and tap <b>သက်တမ်းတိုးမယ်</b> to renew <b>before</b> the expiry date. ` +
          `Once it expires, the account can no longer be extended and a new one must be purchased.</p>` +
          `<p>— PremiumCity</p>`,
        text:
          `Your Netflix account expires on ${endDate} (in ${REMIND_DAYS_BEFORE} days). ` +
          `Open your order and tap သက်တမ်းတိုးမယ် to renew before it expires.`,
      });

      await supabase.from('netflix_expiry_reminders').insert({
        order_item_id: inv.order_item_id,
        end_date: endDate,
      });
      sent++;
    } catch (err) {
      console.error('[netflix-expiry] item failed:', inv.order_item_id, err);
    }
  }

  return NextResponse.json({ ok: true, checked, sent });
}
