// app/api/orders/[id]/nudge/route.ts
//
// Customer pressed "Admin ကို ဆက်သွယ်မယ်" on a manual order that is taking
// longer than 8 hours. Sends the admin ONE Telegram message per order; any
// further presses (or reloads) are ignored.
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LATE_AFTER_MS = 8 * 3600 * 1000;
const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authConfig);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = String(params.id || '');
  const supabase = getServiceSupabaseClient();
  const { data: order } = await supabase
    .from('orders')
    .select('id,user_id,total_amount,status,created_at')
    .eq('id', orderId)
    .maybeSingle();
  const o = order as any;
  if (!o || o.user_id !== session.user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const status = String(o.status || '').toUpperCase();
  const ageMs = Date.now() - new Date(o.created_at).getTime();
  if (status === 'COMPLETED' || status === 'CANCELLED' || ageMs < LATE_AFTER_MS) {
    return NextResponse.json({ ok: true, sent: false });
  }

  // Once per order (lock kept for 30 days).
  const lock = await checkRateLimit({ key: orderId, route: 'order-nudge', windowInSeconds: 30 * 86400, maxRequests: 1 });
  if (!lock.allowed) return NextResponse.json({ ok: true, sent: false, already: true });

  const { data: items } = await supabase
    .from('order_items')
    .select('product_name,variant_name,product_type')
    .eq('order_id', orderId)
    .limit(10);
  const names = ((items ?? []) as any[])
    .map((i) => [i.product_name, i.variant_name].filter(Boolean).join(' · '))
    .filter(Boolean);

  const hours = Math.floor(ageMs / 3600000);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pcitystore.com').replace(/\/$/, '');
  try {
    await sendTelegramMessage({
      text: [
        '⏰ <b>Customer is waiting — manual order over 8 hours</b>',
        `👤 ${esc(String((session.user as any).email || ''))}`,
        names.length ? `📦 ${esc(names.join(', '))}` : '',
        `💵 ${Number(o.total_amount || 0).toLocaleString()} Ks`,
        `🕒 Ordered ${hours} hours ago`,
        `🧾 Order ${esc(orderId.slice(0, 8))}`,
      ].filter(Boolean).join('\n'),
      buttons: [[{ text: '🔗 Open orders', url: `${site}/admin/orders` }]],
    });
  } catch (e) {
    console.error('[order-nudge] telegram failed:', e);
  }
  return NextResponse.json({ ok: true, sent: true });
}
