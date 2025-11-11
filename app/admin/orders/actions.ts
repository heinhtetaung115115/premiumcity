'use server';

import { revalidatePath } from 'next/cache';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/session';
import { sendMail } from '@/lib/mailer';

export async function deliverManualOrder(_: unknown, formData: FormData) {
  await requireAdmin();
  const orderId = String(formData.get('orderId') ?? '');
  const payloadRaw = String(formData.get('payload') ?? '');
  const note = String(formData.get('note') ?? '');

  if (!orderId || !payloadRaw) {
    return { success: false, error: 'Missing payload' };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (error) {
    return { success: false, error: 'Payload must be valid JSON' };
  }

  const supabase = getServiceSupabaseClient();
  const { data: orderRow, error: orderFetchError } = await supabase
    .from('orders')
    .select('id, order_number, user:users(email), order_items(id)')
    .eq('id', orderId)
    .maybeSingle();

  if (orderFetchError) {
    return { success: false, error: orderFetchError.message };
  }

  if (!orderRow) {
    return { success: false, error: 'Order not found' };
  }

  const { error: orderError } = await supabase
    .from('orders')
    .update({ status: 'FULFILLED', manual_payload: payload })
    .eq('id', orderId);

  if (orderError) {
    return { success: false, error: orderError.message };
  }

  const { error: itemError } = await supabase
    .from('order_items')
    .update({ delivered_payload: payload, delivery_status: 'FULFILLED' })
    .eq('order_id', orderId);

  if (itemError) {
    return { success: false, error: itemError.message };
  }

  const user = (orderRow as { user: { email: string | null } | null }).user;
  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: `Your PremiumCity order #${orderRow.order_number} has been delivered`,
      html: `Your order is now ready.<br/><pre>${JSON.stringify(payload, null, 2)}</pre><br/>${note}`
    });
  }

  revalidatePath('/admin/orders');
  revalidatePath('/(dashboard)/orders');
  return { success: true };
}
