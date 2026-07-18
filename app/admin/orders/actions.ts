'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendEmail, tplManualDeliveryToUser } from '@/lib/email';
import type { DeliveryType } from '@/lib/deliveryTypes';
import { isNetflixLink } from '@/lib/netflix';

/* -----------------------------
   Correct type definitions
------------------------------ */
type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  product_type: 'INSTANT' | 'MANUAL';
};

type ManualItemRow = { id: string };
type InventoryCredRow = { order_item_id: string | null };

type OrderRowForEmail = {
  id: string;
  user_id: string;
  // order_number is not in your DB, so we drop it
  // order_number?: string | number | null;
};

export async function fulfillManualItemAction(formData: FormData) {
  await requireAdmin();

  const orderItemId = String(formData.get('orderItemId') ?? '').trim();
  const deliveryType = (String(formData.get('deliveryType') ?? '').trim() ||
    'EMAIL_PASSWORD') as DeliveryType;

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const key = String(formData.get('key') ?? '').trim();
  const inviteLink = String(formData.get('inviteLink') ?? '').trim();
  const netflixLink = String(formData.get('netflixLink') ?? '').trim();

  if (!orderItemId) {
    return { success: false, error: 'Missing order item id' };
  }

  let payload: Record<string, unknown>;

  switch (deliveryType) {
    case 'KEY':
      if (!key) return { success: false, error: 'Key is required' };
      payload = { type: 'key', key };
      break;
    case 'INVITE_LINK':
      if (!inviteLink) return { success: false, error: 'Invite link is required' };
      payload = { type: 'invite_link', inviteLink };
      break;
    case 'NOTE':
      if (!note) return { success: false, error: 'Note is required' };
      payload = { type: 'note', note };
      break;
    case 'NETFLIX_PANEL': {
      if (!netflixLink) return { success: false, error: 'Supplier link is required' };
      if (!isNetflixLink(netflixLink)) {
        return { success: false, error: 'That does not look like a valid supplier account link.' };
      }
      payload = { type: 'netflix_panel', link: netflixLink };
      if (note) payload.note = note;
      break;
    }
    case 'EMAIL_PASSWORD':
    default:
      if (!email && !password && !note) {
        return { success: false, error: 'Provide at least one of email, password, or note' };
      }
      payload = { type: 'email_password' };
      if (email) payload.email = email;
      if (password) payload.password = password;
      if (note) payload.note = note;
      break;
  }

  const supabase = getServiceSupabaseClient();

  // --------------------------------------
  // 1) Load the order item
  // --------------------------------------
  const { data: rawItem, error: itemError } = await supabase
    .from('order_items')
    .select('id,order_id,product_id,product_type')
    .eq('id', orderItemId)
    .maybeSingle();

  if (itemError) {
    return { success: false, error: itemError.message };
  }
  if (!rawItem) {
    return { success: false, error: 'Order item not found' };
  }

  const item = rawItem as OrderItemRow;

  if (item.product_type !== 'MANUAL') {
    return { success: false, error: 'This item is not a manual product' };
  }

  // --------------------------------------
  // 3) Insert credentials row
  // --------------------------------------
  const { error: invError } = await supabase.from('inventory_items').insert({
    product_id: item.product_id,
    order_item_id: item.id,
    payload,
  });

  if (invError) {
    return { success: false, error: invError.message };
  }

  // --------------------------------------
  // 3b) Send email to user for this manual delivery
  //      (per Save & deliver click)
  // --------------------------------------
  try {
    console.log(
      '[fulfillManualItemAction] Starting email flow for orderItemId=',
      orderItemId
    );

    // Load order row to get user_id (no order_number column in DB)
    const { data: orderRow, error: orderRowError } = await supabase
      .from('orders')
      .select('id,user_id')
      .eq('id', item.order_id)
      .maybeSingle();

    if (orderRowError) {
      console.error(
        '[fulfillManualItemAction] Error loading orderRow:',
        orderRowError.message
      );
    }

    if (!orderRow) {
      console.warn(
        '[fulfillManualItemAction] No orderRow found for order_id=',
        item.order_id
      );
    }

    if (!orderRowError && orderRow) {
      const order = orderRow as OrderRowForEmail;
      console.log(
        '[fulfillManualItemAction] Loaded orderRow:',
        JSON.stringify(order)
      );

      // Load user email using user_id
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('id', order.user_id)
        .maybeSingle();

      if (userError) {
        console.error(
          '[fulfillManualItemAction] Error loading userRow:',
          userError.message
        );
      }

      if (!userRow) {
        console.warn(
          '[fulfillManualItemAction] No userRow found for user_id=',
          order.user_id
        );
      }

      const dbEmail = (userRow as any)?.email as string | undefined;
      // Prefer the email from users table; fall back to form email if needed
      const targetEmail = dbEmail || email || '';

      console.log(
        '[fulfillManualItemAction] Email candidates -> dbEmail=',
        dbEmail,
        ' formEmail=',
        email,
        ' targetEmail=',
        targetEmail
      );

      if (!targetEmail) {
        console.warn(
          '[fulfillManualItemAction] No targetEmail available, skipping sendEmail.'
        );
      } else {
        // Since order_number column doesn't exist, just use the order id as label
        const orderNumber = order.id;

        const { subject, html, text } = tplManualDeliveryToUser(
          targetEmail,
          orderNumber,
          note || undefined
        );

        console.log(
          '[fulfillManualItemAction] Sending manual delivery email to:',
          targetEmail,
          ' subject=',
          subject
        );

        const result = await sendEmail({
          to: targetEmail,
          subject,
          html,
          text,
        });

        console.log(
          '[fulfillManualItemAction] sendEmail result:',
          JSON.stringify(result)
        );
      }
    }
  } catch (e) {
    console.error('Failed to send manual delivery email:', e);
    // Do not block admin flow if email fails
  }

  // --------------------------------------
  // 4) Check if ALL manual items for this order are fulfilled
  //     (still keep your existing status logic)
  // --------------------------------------
  const { data: rawManualItems, error: manualItemsError } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', item.order_id)
    .eq('product_type', 'MANUAL');

  const manualItems = rawManualItems as ManualItemRow[] | null;

  if (!manualItemsError && manualItems) {
    const manualIds = manualItems.map((mi) => mi.id);

    if (manualIds.length > 0) {
      const { data: rawCredRows, error: credError } = await supabase
        .from('inventory_items')
        .select('order_item_id')
        .in('order_item_id', manualIds);

      const credRows = rawCredRows as InventoryCredRow[] | null;

      if (!credError && credRows) {
        const fulfilled = new Set(
          credRows
            .map((r) => r.order_item_id)
            .filter((id): id is string => Boolean(id))
        );

        const hasUnfulfilled = manualIds.some((id) => !fulfilled.has(id));

        if (!hasUnfulfilled) {
          await supabase
            .from('orders')
            .update({ status: 'COMPLETED' })
            .eq('id', item.order_id);
        }
      }
    }
  }

  // --------------------------------------
  // 5) Revalidate
  // --------------------------------------
  revalidatePath('/admin/orders');
  revalidatePath('/orders');

  return { success: true };
}

/**
 * Dismiss a manual delivery from the pending list.
 * Use when the order was already delivered outside the system (e.g. via Telegram).
 * Marks the item as delivered by inserting a note, without sending an email.
 */
export async function dismissManualDeliveryAction(formData: FormData) {
  await requireAdmin();

  const orderItemId = String(formData.get('orderItemId') ?? '').trim();
  if (!orderItemId) {
    return { success: false, error: 'Missing order item id' };
  }

  const supabase = getServiceSupabaseClient();

  // Load the item to get product_id and confirm it's manual
  const { data: rawItem, error: itemError } = await supabase
    .from('order_items')
    .select('id,order_id,product_id,product_type')
    .eq('id', orderItemId)
    .maybeSingle();

  if (itemError) {
    return { success: false, error: itemError.message };
  }
  if (!rawItem) {
    return { success: false, error: 'Order item not found' };
  }

  const item = rawItem as OrderItemRow;
  if (item.product_type !== 'MANUAL') {
    return { success: false, error: 'This item is not a manual product' };
  }

  // Insert a delivery record marking it delivered outside the system.
  // This removes it from the pending manual deliveries list.
  const { error: invError } = await supabase.from('inventory_items').insert({
    product_id: item.product_id,
    order_item_id: item.id,
    payload: { type: 'note', note: 'Delivered manually (outside system, e.g. Telegram)' },
  });

  if (invError) {
    return { success: false, error: invError.message };
  }

  // Mark the order item and order as completed if all manual items are done
  const { data: siblingItems } = await supabase
    .from('order_items')
    .select('id')
    .eq('order_id', item.order_id)
    .eq('product_type', 'MANUAL');

  const manualIds = ((siblingItems ?? []) as { id: string }[]).map((r) => r.id);

  if (manualIds.length > 0) {
    const { data: fulfilledRows } = await supabase
      .from('inventory_items')
      .select('order_item_id')
      .in('order_item_id', manualIds);

    const fulfilled = new Set(
      ((fulfilledRows ?? []) as { order_item_id: string | null }[])
        .map((r) => r.order_item_id)
        .filter(Boolean)
    );

    const hasUnfulfilled = manualIds.some((id) => !fulfilled.has(id));
    if (!hasUnfulfilled) {
      await supabase
        .from('orders')
        .update({ status: 'COMPLETED' })
        .eq('id', item.order_id);
    }
  }

  revalidatePath('/admin');
  revalidatePath('/admin/orders');
  revalidatePath('/orders');

  return { success: true };
}
