'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendEmail, tplManualDeliveryToUser, tplAccountUpdatedToUser } from '@/lib/email';
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
  product_name?: string | null;
  variant_name?: string | null;
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
    .select('id,order_id,product_id,product_type,product_name,variant_name')
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
        .select('email,name')
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

        const { subject, html, text } = tplManualDeliveryToUser({
          name: (userRow as any)?.name || targetEmail.split('@')[0],
          orderId: orderNumber,
          productName: [item.product_name, item.variant_name].filter(Boolean).join(' · ') || null,
          note: note || undefined,
        });

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


export type UpdateCredentialResult = { ok: boolean; error?: string; emailed?: boolean };

/**
 * Edit the email/password on an account that was ALREADY delivered on an order
 * (e.g. a warranty replacement). The customer's Orders page reads the same row,
 * so they see the new details immediately. Optionally emails the customer.
 *
 * Only email/password credentials can be edited here — keys, invite links and
 * Netflix supplier links are a different shape (Netflix links have their own
 * "Replace supplier link" tool on /admin/renewals).
 */
export async function updateDeliveredCredentialAction(
  formData: FormData
): Promise<UpdateCredentialResult> {
  await requireAdmin();

  const inventoryItemId = String(formData.get('inventoryItemId') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const notify = formData.get('notify') === 'on';

  if (!inventoryItemId) return { ok: false, error: 'Missing credential id.' };
  if (!email && !password) return { ok: false, error: 'Email or password is required.' };

  const supabase = getServiceSupabaseClient();

  const { data: row, error: rowErr } = await supabase
    .from('inventory_items')
    .select('id,order_item_id,payload')
    .eq('id', inventoryItemId)
    .maybeSingle();
  if (rowErr) return { ok: false, error: rowErr.message };
  if (!row) return { ok: false, error: 'Credential not found.' };

  const r: any = row;
  if (!r.order_item_id) {
    return { ok: false, error: 'This credential is unsold stock, not a delivered order.' };
  }

  const old: any = r.payload && typeof r.payload === 'object' ? r.payload : {};
  const isEmailPassword =
    old.type === 'email_password' ||
    (!old.type && (typeof old.email === 'string' || typeof old.password === 'string'));
  if (!isEmailPassword) {
    return { ok: false, error: 'Only email/password accounts can be edited here.' };
  }

  if (email === (old.email ?? '') && password === (old.password ?? '') && note === (old.note ?? '')) {
    return { ok: false, error: 'Nothing changed.' };
  }

  // Keep a short audit trail of WHEN details changed (no old passwords stored —
  // this payload is also sent to the customer's Orders page).
  const history = Array.isArray(old.history) ? old.history.slice(-4) : [];
  history.push({ email: old.email ?? null, changedAt: new Date().toISOString() });

  const payload: Record<string, unknown> = {
    type: 'email_password', // also upgrades legacy untyped rows
    ...(email ? { email } : {}),
    ...(password ? { password } : {}),
    ...(note ? { note } : {}),
    history,
  };

  const { error: updErr } = await supabase
    .from('inventory_items')
    .update({ payload })
    .eq('id', inventoryItemId);
  if (updErr) return { ok: false, error: updErr.message };

  revalidatePath('/admin/orders');
  revalidatePath('/admin/users');
  revalidatePath('/orders');

  if (!notify) return { ok: true, emailed: false };

  // Email the customer who owns this order.
  try {
    const { data: item } = await supabase
      .from('order_items')
      .select('order_id,product_name,variant_name')
      .eq('id', r.order_item_id)
      .maybeSingle();
    const it: any = item ?? {};
    const { data: order } = it.order_id
      ? await supabase.from('orders').select('id,user_id').eq('id', it.order_id).maybeSingle()
      : { data: null };
    const o: any = order ?? {};
    const { data: user } = o.user_id
      ? await supabase.from('users').select('email,name').eq('id', o.user_id).maybeSingle()
      : { data: null };
    const userEmail: string = (user as any)?.email ?? '';
    if (!userEmail) return { ok: true, emailed: false, error: 'Saved, but no customer email found.' };

    const productName = [it.product_name, it.variant_name].filter(Boolean).join(' · ') || 'your product';
    const { subject, html, text } = tplAccountUpdatedToUser({
      name: (user as any)?.name || userEmail.split('@')[0],
      orderId: o.id ?? null,
      productName,
      note,
    });
    const sent: any = await sendEmail({ to: userEmail, subject, html, text });
    if (sent?.ok === false || sent?.skipped) {
      return { ok: true, emailed: false, error: 'Saved, but the email could not be sent.' };
    }
    return { ok: true, emailed: true };
  } catch (err) {
    console.error('[updateDeliveredCredential] email failed:', err);
    return { ok: true, emailed: false, error: 'Saved, but the email could not be sent.' };
  }
}
