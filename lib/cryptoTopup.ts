// lib/cryptoTopup.ts
import { getServiceSupabaseClient } from '@/lib/supabase';
import { getRateInfo } from '@/lib/cryptoRate';
import { createPayment, getMinAmount, findNetwork, PAY_CURRENCY } from '@/lib/nowpayments';

/** Our own floor, in USD. Can be raised by NOWPayments' pair minimum. */
export const MIN_USD = 5;
export const MAX_USD = 1000;

/** How long a locked rate stays valid. */
const RATE_LOCK_MINUTES = 30;

export type CryptoTopupRow = {
  id: string;
  user_id: string;
  order_id: string;
  payment_id: string | null;
  usd_amount: number;
  mmk_amount: number;
  rate: number;
  pay_address: string | null;
  pay_amount: number | null;
  pay_currency: string | null;
  status: string;
  credited: boolean;
  created_at: string;
  expires_at: string | null;
};

/**
 * Effective minimum for a specific network: the larger of our own floor and
 * whatever NOWPayments says that network requires. Checked live so we never
 * create an invoice that physically cannot complete.
 *
 * NOTE: we cannot simply force our $5 floor — if NOWPayments' minimum for a
 * chain is higher (Ethereum gas, for instance), a smaller payment will not
 * process and the customer's funds get stuck in a dead invoice.
 */
export async function getEffectiveMinUsd(payCurrency: string = PAY_CURRENCY): Promise<number> {
  const npMin = await getMinAmount(payCurrency); // vs YOUR payout wallet currency
  if (npMin && npMin > MIN_USD) return Math.ceil(npMin * 100) / 100;
  return MIN_USD;
}

/**
 * Create a crypto top-up.
 *
 * The MMK amount and rate are LOCKED here and stored. The webhook credits
 * that stored amount — it never recomputes from a live rate. Otherwise a
 * customer could open an invoice, wait for the rate to move, then pay.
 */
export async function createCryptoTopup(params: {
  userId: string;
  usdAmount: number;
  payCurrency?: string;
}): Promise<CryptoTopupRow> {
  const { userId } = params;
  const usdAmount = Math.round(params.usdAmount * 100) / 100;

  // Only allow networks we actually support — never trust the client.
  const payCurrency = params.payCurrency || PAY_CURRENCY;
  if (!findNetwork(payCurrency)) {
    throw new Error('Unsupported network.');
  }

  if (!Number.isFinite(usdAmount)) throw new Error('Invalid amount.');
  if (usdAmount > MAX_USD) throw new Error(`Maximum is $${MAX_USD}.`);

  const minUsd = await getEffectiveMinUsd(payCurrency);
  if (usdAmount < minUsd) {
    throw new Error(`Minimum for this network is $${minUsd}.`);
  }

  const rateInfo = await getRateInfo();
  const mmkAmount = Math.floor(usdAmount * rateInfo.effectiveRate);
  if (mmkAmount <= 0) throw new Error('Rate unavailable. Please try again later.');

  const supabase = getServiceSupabaseClient();

  // Our reference, echoed back by the webhook.
  const orderId = `pc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt = new Date(Date.now() + RATE_LOCK_MINUTES * 60 * 1000).toISOString();

  // Insert BEFORE calling NOWPayments, so a payment can never exist without a
  // row to match it against.
  const { data: inserted, error: insertError } = await supabase
    .from('crypto_topups')
    .insert({
      user_id: userId,
      order_id: orderId,
      usd_amount: usdAmount,
      mmk_amount: mmkAmount,
      rate: rateInfo.effectiveRate,
      status: 'NEW',
      credited: false,
      expires_at: expiresAt,
    })
    .select('*')
    .maybeSingle();

  if (insertError) throw insertError;
  const row = inserted as any as CryptoTopupRow;

  // Now create the actual payment.
  let payment;
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://pcitystore.com';
    payment = await createPayment({
      priceAmount: usdAmount,
      orderId,
      payCurrency,
      orderDescription: `PremiumCity wallet top-up (${mmkAmount.toLocaleString()} Ks)`,
      ipnCallbackUrl: `${base}/api/crypto/webhook`,
    });
  } catch (err) {
    await supabase
      .from('crypto_topups')
      .update({ status: 'FAILED' })
      .eq('id', row.id);
    throw err;
  }

  const { data: updated, error: updError } = await supabase
    .from('crypto_topups')
    .update({
      payment_id: payment.paymentId,
      pay_address: payment.payAddress,
      pay_amount: payment.payAmount,
      pay_currency: payment.payCurrency,
      status: 'WAITING',
    })
    .eq('id', row.id)
    .select('*')
    .maybeSingle();

  if (updError) throw updError;
  return updated as any as CryptoTopupRow;
}

export async function getCryptoTopupById(
  id: string,
  userId?: string
): Promise<CryptoTopupRow | null> {
  const supabase = getServiceSupabaseClient();
  let q = supabase.from('crypto_topups').select('*').eq('id', id);
  if (userId) q = q.eq('user_id', userId);
  const { data } = await q.maybeSingle();
  return (data as any) ?? null;
}

export async function listCryptoTopupsForUser(userId: string, limit = 20) {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('crypto_topups')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as any[]) as CryptoTopupRow[];
}

/**
 * Credit the wallet for a confirmed crypto top-up.
 *
 * IDEMPOTENT BY CONSTRUCTION: we atomically flip `credited` from false->true
 * with a conditional update. Only one caller can win that race, so duplicate
 * webhook deliveries (which NOWPayments *will* send on retry) cannot
 * double-credit. If crediting then fails, we revert the flag so it can retry.
 */
export async function creditCryptoTopup(topupId: string): Promise<{
  credited: boolean;
  reason: string;
}> {
  const supabase = getServiceSupabaseClient();

  // Atomically claim. .eq('credited', false) is the guard.
  const { data: claimed, error: claimError } = await supabase
    .from('crypto_topups')
    .update({ credited: true, status: 'CREDITED' })
    .eq('id', topupId)
    .eq('credited', false)
    .select('id,user_id,mmk_amount,usd_amount')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) {
    // Already credited (duplicate webhook) — this is a success, not an error.
    return { credited: false, reason: 'already_credited' };
  }

  const t = claimed as any;
  const userId = t.user_id as string;
  const amount = Number(t.mmk_amount);

  try {
    const { data: walletRow, error: walletError } = await supabase
      .from('wallets')
      .select('id,balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (walletError) throw walletError;

    let walletId: string;

    if (!walletRow) {
      const { data: newWallet, error: createErr } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: amount })
        .select('id')
        .maybeSingle();
      if (createErr) throw createErr;
      walletId = (newWallet as any).id;
    } else {
      walletId = (walletRow as any).id;
      const current = Number((walletRow as any).balance ?? 0);
      const { error: updErr } = await supabase
        .from('wallets')
        .update({ balance: current + amount })
        .eq('id', walletId);
      if (updErr) throw updErr;
    }

    const { error: txErr } = await supabase.from('wallet_transactions').insert({
      wallet_id: walletId,
      amount,
      direction: 'CREDIT',
      description: `Crypto top-up ($${Number(t.usd_amount).toFixed(2)} USDT)`,
    });
    if (txErr) throw txErr;

    return { credited: true, reason: 'ok' };
  } catch (err) {
    // Revert the claim so a retry can pick it up, rather than silently
    // leaving the customer paid-but-uncredited.
    console.error('[cryptoTopup] crediting failed, reverting claim', err);
    await supabase
      .from('crypto_topups')
      .update({ credited: false, status: 'CONFIRMED' })
      .eq('id', topupId);
    throw err;
  }
}

/** Update status from a webhook/poll without crediting. */
export async function updateCryptoTopupStatus(
  topupId: string,
  status: string
): Promise<void> {
  const supabase = getServiceSupabaseClient();
  await supabase.from('crypto_topups').update({ status }).eq('id', topupId);
}

export async function findByOrderId(orderId: string): Promise<CryptoTopupRow | null> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('crypto_topups')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle();
  return (data as any) ?? null;
}
