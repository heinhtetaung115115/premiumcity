// lib/netflixRenewal.ts
// Netflix subscription renewals (သက်တမ်းတိုး).
//
// FLOW (as specified):
//   1. Customer picks a plan (reuses the Netflix product's own variants/prices)
//   2. Wallet is DEBITED immediately, atomically, with a balance check
//   3. A PENDING renewal request is created; you extend with the supplier by hand
//   4. You APPROVE (keep the money) or REJECT (auto-refund to wallet)
//
// RULES:
//   • Renewal is blocked if the account has already expired (endDate passed) —
//     the supplier link can't be extended after expiry, so we don't take money
//     for something we can't fulfil.
//   • Debit is atomic: we claim the balance with a conditional update so two
//     rapid clicks can't double-charge or overdraw.
//   • Reject refunds exactly what was debited, once (idempotent).

import { getServiceSupabaseClient } from '@/lib/supabase';
import { fetchNetflixPanel } from '@/lib/netflix';

export type RenewalPlan = { variantId: string; name: string; price: number };

/** The plans a customer can renew with = the Netflix product's active variants. */
export async function getRenewalPlans(orderItemId: string, userId: string): Promise<{
  ok: boolean;
  plans?: RenewalPlan[];
  expired?: boolean;
  endDate?: string | null;
  error?: string;
}> {
  const supabase = getServiceSupabaseClient();

  // Verify ownership + get the product this item belongs to.
  const { data: item } = await supabase
    .from('order_items')
    .select('id,order_id,product_id')
    .eq('id', orderItemId)
    .maybeSingle();
  if (!item) return { ok: false, error: 'not found' };

  const { data: order } = await supabase
    .from('orders')
    .select('user_id')
    .eq('id', (item as any).order_id)
    .maybeSingle();
  if (!order || (order as any).user_id !== userId) return { ok: false, error: 'not found' };

  // The supplier link (to read the current expiry).
  const { data: inv } = await supabase
    .from('inventory_items')
    .select('payload')
    .eq('order_item_id', orderItemId)
    .maybeSingle();
  const payload: any = (inv as any)?.payload;
  if (!payload || payload.type !== 'netflix_panel' || !payload.link) {
    return { ok: false, error: 'This item is not a Netflix account.' };
  }

  // Check expiry from the live panel. If it's already expired, block renewal.
  const panel = await fetchNetflixPanel(String(payload.link));
  const endDate = panel.ok ? panel.profile?.endDate ?? null : null;
  if (endDate) {
    const end = new Date(endDate + 'T23:59:59'); // treat end-of-day as still valid
    if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
      return { ok: true, plans: [], expired: true, endDate };
    }
  }

  // Load the product's active variants as renewal plans.
  const { data: variants } = await supabase
    .from('product_variants')
    .select('id,name,price,is_active,position')
    .eq('product_id', (item as any).product_id)
    .eq('is_active', true)
    .order('position', { ascending: true });

  const plans: RenewalPlan[] = ((variants ?? []) as any[]).map((v) => ({
    variantId: v.id,
    name: v.name,
    price: Number(v.price),
  }));

  return { ok: true, plans, expired: false, endDate };
}

/**
 * Submit a renewal: debit the wallet atomically, then create the pending
 * request. Returns a flat result (strict:false can't narrow unions).
 */
export async function submitRenewal(params: {
  orderItemId: string;
  userId: string;
  variantId: string;
}): Promise<{ ok: boolean; error?: string; renewalId?: string; price?: number; planName?: string }> {
  const supabase = getServiceSupabaseClient();
  const { orderItemId, userId, variantId } = params;

  // Ownership + product.
  const { data: item } = await supabase
    .from('order_items')
    .select('id,order_id,product_id')
    .eq('id', orderItemId)
    .maybeSingle();
  if (!item) return { ok: false, error: 'not found' };

  const { data: order } = await supabase
    .from('orders')
    .select('user_id')
    .eq('id', (item as any).order_id)
    .maybeSingle();
  if (!order || (order as any).user_id !== userId) return { ok: false, error: 'not found' };

  // No duplicate open request.
  const { data: pending } = await supabase
    .from('netflix_renewals')
    .select('id')
    .eq('order_item_id', orderItemId)
    .eq('status', 'PENDING')
    .maybeSingle();
  if (pending) return { ok: false, error: 'You already have a pending renewal for this account.' };

  // The chosen plan must be a valid, active variant of THIS product.
  const { data: variant } = await supabase
    .from('product_variants')
    .select('id,name,price,product_id,is_active')
    .eq('id', variantId)
    .maybeSingle();
  if (
    !variant ||
    (variant as any).product_id !== (item as any).product_id ||
    !(variant as any).is_active
  ) {
    return { ok: false, error: 'Invalid plan.' };
  }
  const price = Number((variant as any).price);
  const planName = String((variant as any).name);
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'Invalid plan price.' };

  // Block renewal if expired.
  const { data: inv } = await supabase
    .from('inventory_items')
    .select('payload')
    .eq('order_item_id', orderItemId)
    .maybeSingle();
  const payload: any = (inv as any)?.payload;
  if (payload?.link) {
    const panel = await fetchNetflixPanel(String(payload.link));
    const endDate = panel.ok ? panel.profile?.endDate ?? null : null;
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) {
        return { ok: false, error: 'This account has expired and cannot be renewed. Please buy a new one.' };
      }
    }
  }

  // ── Atomic debit ──
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id,balance')
    .eq('user_id', userId)
    .maybeSingle();

  const balance = Number((wallet as any)?.balance ?? 0);
  if (!wallet || balance < price) {
    return { ok: false, error: 'Not enough wallet balance for this plan.' };
  }

  // Conditional update: only succeeds if the balance is still what we read.
  // Prevents two quick clicks from both passing the check and double-charging.
  const { data: debited } = await supabase
    .from('wallets')
    .update({ balance: balance - price })
    .eq('id', (wallet as any).id)
    .eq('balance', balance) // optimistic lock
    .select('id')
    .maybeSingle();

  if (!debited) {
    return { ok: false, error: 'Balance changed, please try again.' };
  }

  // Ledger entry for the debit.
  await supabase.from('wallet_transactions').insert({
    wallet_id: (wallet as any).id,
    amount: price,
    direction: 'DEBIT',
    description: `Netflix renewal — ${planName}`,
  });

  // Create the pending request (records what was charged, for refund on reject).
  const { data: renewal, error: insErr } = await supabase
    .from('netflix_renewals')
    .insert({
      order_item_id: orderItemId,
      order_id: (item as any).order_id,
      user_id: userId,
      status: 'PENDING',
      variant_id: variantId,
      plan_name: planName,
      amount: price,
    })
    .select('id')
    .maybeSingle();

  if (insErr || !renewal) {
    // Roll the debit back — never take money without recording the request.
    await supabase
      .from('wallets')
      .update({ balance: balance }) // restore
      .eq('id', (wallet as any).id);
    await supabase.from('wallet_transactions').insert({
      wallet_id: (wallet as any).id,
      amount: price,
      direction: 'CREDIT',
      description: `Netflix renewal refund (could not record request)`,
    });
    return { ok: false, error: 'Could not submit the renewal. Your balance was not affected.' };
  }

  return { ok: true, renewalId: (renewal as any).id, price, planName };
}

/** Admin: approve a pending renewal (keep the money). Idempotent. */
export async function approveRenewal(renewalId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabaseClient();
  const { data: claimed } = await supabase
    .from('netflix_renewals')
    .update({ status: 'APPROVED', resolved_at: new Date().toISOString() })
    .eq('id', renewalId)
    .eq('status', 'PENDING')
    .select('id')
    .maybeSingle();

  if (!claimed) return { ok: false, error: 'Already resolved or not found.' };
  return { ok: true };
}

/** Admin: reject a pending renewal → auto-refund to wallet. Idempotent. */
export async function rejectRenewal(renewalId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabaseClient();

  // Claim it first so a double-click can't refund twice.
  const { data: claimed } = await supabase
    .from('netflix_renewals')
    .update({ status: 'REJECTED', resolved_at: new Date().toISOString() })
    .eq('id', renewalId)
    .eq('status', 'PENDING')
    .select('id,user_id,amount,plan_name')
    .maybeSingle();

  if (!claimed) return { ok: false, error: 'Already resolved or not found.' };

  const c: any = claimed;
  const amount = Number(c.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: true }; // nothing to refund

  // Refund to wallet.
  const { data: wallet } = await supabase
    .from('wallets')
    .select('id,balance')
    .eq('user_id', c.user_id)
    .maybeSingle();

  if (wallet) {
    const bal = Number((wallet as any).balance ?? 0);
    await supabase
      .from('wallets')
      .update({ balance: bal + amount })
      .eq('id', (wallet as any).id);
    await supabase.from('wallet_transactions').insert({
      wallet_id: (wallet as any).id,
      amount,
      direction: 'CREDIT',
      description: `Netflix renewal refund — ${c.plan_name ?? ''}`.trim(),
    });
  } else {
    // No wallet somehow — create one holding the refund.
    const { data: nw } = await supabase
      .from('wallets')
      .insert({ user_id: c.user_id, balance: amount })
      .select('id')
      .maybeSingle();
    if (nw) {
      await supabase.from('wallet_transactions').insert({
        wallet_id: (nw as any).id,
        amount,
        direction: 'CREDIT',
        description: `Netflix renewal refund — ${c.plan_name ?? ''}`.trim(),
      });
    }
  }

  return { ok: true };
}

/** Admin: replace the supplier link on a Netflix order item. */
export async function updateNetflixLink(
  orderItemId: string,
  newLink: string
): Promise<{ ok: boolean; error?: string }> {
  const { isNetflixLink } = await import('@/lib/netflix');
  if (!isNetflixLink(newLink)) return { ok: false, error: 'Not a valid supplier link.' };

  const supabase = getServiceSupabaseClient();
  const { data: inv } = await supabase
    .from('inventory_items')
    .select('id,payload')
    .eq('order_item_id', orderItemId)
    .maybeSingle();

  if (!inv) return { ok: false, error: 'No delivery found for this item.' };

  const payload: any = { ...((inv as any).payload ?? {}), type: 'netflix_panel', link: newLink };
  const { error } = await supabase
    .from('inventory_items')
    .update({ payload })
    .eq('id', (inv as any).id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
