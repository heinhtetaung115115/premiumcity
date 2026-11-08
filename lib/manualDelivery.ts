// lib/manualDelivery.ts
// Deliver a payload to a MANUAL order item (same steps as the admin
// "Save & deliver" form): store it, email the customer, complete the order
// when every manual item is delivered. Used by automated deliveries.

import { getServiceSupabaseClient } from './supabase';
import { sendEmail, tplManualDeliveryToUser } from './email';

export async function deliverToOrderItem(
  orderItemId: string,
  payload: Record<string, unknown>,
  opts: { note?: string } = {}
): Promise<{ ok: boolean; error?: string; orderId?: string }> {
  const supabase = getServiceSupabaseClient();

  const { data: item, error: itemErr } = await supabase
    .from('order_items')
    .select('id,order_id,product_id,product_type,product_name,variant_name')
    .eq('id', orderItemId)
    .maybeSingle();
  if (itemErr) return { ok: false, error: itemErr.message };
  if (!item) return { ok: false, error: 'Order item not found' };
  const it = item as any;
  if (String(it.product_type).toUpperCase() !== 'MANUAL') return { ok: false, error: 'Not a manual product' };

  const { data: existing } = await supabase.from('inventory_items').select('id').eq('order_item_id', orderItemId).limit(1);
  if (((existing ?? []) as any[]).length > 0) return { ok: false, error: 'Already delivered' };

  const { error: invErr } = await supabase.from('inventory_items').insert({
    product_id: it.product_id,
    order_item_id: it.id,
    payload,
  });
  if (invErr) return { ok: false, error: invErr.message };

  // Email the customer (never blocks delivery)
  try {
    const { data: order } = await supabase.from('orders').select('id,user_id').eq('id', it.order_id).maybeSingle();
    if (order) {
      const { data: user } = await supabase.from('users').select('email,name').eq('id', (order as any).user_id).maybeSingle();
      const to = (user as any)?.email as string | undefined;
      if (to) {
        const { subject, html, text } = tplManualDeliveryToUser({
          name: (user as any)?.name || to.split('@')[0],
          orderId: (order as any).id,
          productName: [it.product_name, it.variant_name].filter(Boolean).join(' · ') || null,
          note: opts.note,
        });
        await sendEmail({ to, subject, html, text });
      }
    }
  } catch (e) {
    console.error('[deliverToOrderItem] email failed', e);
  }

  // Complete the order when all manual items have a delivery
  const { data: manualItems } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', it.order_id)
    .eq('product_type', 'MANUAL');
  const ids = ((manualItems ?? []) as any[]).map((m) => m.id);
  if (ids.length) {
    const { data: creds } = await supabase.from('inventory_items').select('order_item_id').in('order_item_id', ids);
    const done = new Set(((creds ?? []) as any[]).map((c) => c.order_item_id));
    if (ids.every((id) => done.has(id))) {
      await supabase.from('orders').update({ status: 'COMPLETED' }).eq('id', it.order_id);
    }
  }
  return { ok: true, orderId: it.order_id };
}
