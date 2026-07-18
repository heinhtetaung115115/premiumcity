// app/api/netflix/renew/route.ts
// Customer requests a renewal (သက်တမ်းတိုး). This does NOT touch the supplier —
// it records a pending task and pings you on Telegram so you can arrange the
// extension with your supplier and then update the link.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getServerSession(authConfig);
  const userId = session?.user?.id;
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const orderItemId = String(body?.orderItemId ?? '');
  if (!orderItemId) return NextResponse.json({ error: 'missing orderItemId' }, { status: 400 });

  const supabase = getServiceSupabaseClient();

  // Verify ownership + that this really is a Netflix panel item.
  const { data: item } = await supabase
    .from('order_items')
    .select('id,order_id,product_id')
    .eq('id', orderItemId)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: order } = await supabase
    .from('orders')
    .select('id,user_id')
    .eq('id', (item as any).order_id)
    .maybeSingle();
  if (!order || (order as any).user_id !== userId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Guard against duplicate open requests.
  const { data: existing } = await supabase
    .from('netflix_renewals')
    .select('id,status')
    .eq('order_item_id', orderItemId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyPending: true });
  }

  // Record the task.
  const { error: insErr } = await supabase.from('netflix_renewals').insert({
    order_item_id: orderItemId,
    order_id: (order as any).id,
    user_id: userId,
    status: 'PENDING',
  });
  if (insErr) {
    console.error('[netflix/renew] insert failed:', insErr);
    return NextResponse.json({ error: 'Could not submit the request.' }, { status: 500 });
  }

  // Notify you.
  try {
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle();

    await sendTelegramMessage({
      text:
        `🔁 <b>Netflix renewal requested</b>\n\n` +
        `User: ${(user as any)?.email ?? userId}\n` +
        `Order: ${(order as any).id}\n` +
        `Item: ${orderItemId}\n\n` +
        `Arrange the extension with your supplier, then update the link in admin.`,
    });
  } catch (err) {
    console.error('[netflix/renew] telegram failed:', err);
    // The task is recorded even if Telegram fails — don't fail the request.
  }

  return NextResponse.json({ ok: true });
}
