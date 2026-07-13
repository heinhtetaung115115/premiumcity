// lib/cryptoTopup.ts
// Create crypto top-ups (Heleket) and credit wallets on confirmation.
//
// TWO PROPERTIES THAT MATTER MOST:
//
// 1. THE CUSTOMER PAYS THE GATEWAY FEE.
//    We credit MMK from `merchant_amount` — Heleket's figure AFTER their 2%
//    commission, i.e. what actually lands in your balance. Customer sends $5,
//    Heleket takes $0.10, we credit 4.90 x rate. You are never out of pocket.
//
// 2. THE RATE IS LOCKED, BUT THE AMOUNT IS NOT.
//    We lock MMK-per-USD at creation, then multiply by whatever NET USD
//    actually arrived. That single choice handles overpayment (paid_over) and
//    underpayment for free: the customer always gets credited exactly what
//    they actually paid, at the rate they were quoted.
//
// Crediting is IDEMPOTENT — Heleket retries webhooks and fires multiple status
// transitions, so we claim the row with a conditional update. Only one caller
// can ever win.

import { getServiceSupabaseClient } from '@/lib/supabase';
import { getEffectiveRate } from '@/lib/cryptoRate';
import { createInvoice, getServices, toPayOptions, type PayOption } from '@/lib/heleket';

/** Your floor. Heleket's per-network minimum may be higher — we take the max. */
export const MIN_USD = 3;
export const MAX_USD = 1000;

const INVOICE_LIFETIME_SEC = 3600; // 1 hour to pay

export type CryptoTopupRow = {
  id: string;
  user_id: string;
  invoice_uuid: string | null;
  usd_amount: number;
  pay_currency: string | null;
  network: string | null;
  pay_amount: number | null;
  pay_address: string | null;
  pay_url: string | null;
  rate: number; // MMK per 1 USD, locked
  mmk_amount: number; // estimate shown at creation
  status: string;
  credited: boolean;
  created_at: string;
  expires_at: string | null;
};

export async function getPayOptions(): Promise<PayOption[]> {
  const services = await getServices();
  return toPayOptions(services);
}

/** Quote for the form: the locked rate + our floor. */
export async function getCryptoQuote(): Promise<{
  ok: boolean;
  rate?: number;
  minUsd?: number;
  maxUsd?: number;
  error?: string;
}> {
  const rate = await getEffectiveRate(5);
  if (!rate) {
    return {
      ok: false,
      error: 'Crypto top-up is temporarily unavailable (no exchange rate set).',
    };
  }
  return { ok: true, rate: rate.effectiveRate, minUsd: MIN_USD, maxUsd: MAX_USD };
}

export async function createCryptoTopup(params: {
  userId: string;
  usdAmount: number;
  currency: string;
  network: string;
  siteUrl: string;
}): Promise<CryptoTopupRow> {
  const usdAmount = Math.round(params.usdAmount * 100) / 100;

  if (!Number.isFinite(usdAmount)) throw new Error('Invalid amount.');
  if (usdAmount < MIN_USD) throw new Error(`Minimum top-up is $${MIN_USD}.`);
  if (usdAmount > MAX_USD) throw new Error(`Maximum top-up is $${MAX_USD}.`);

  // Never trust the client's coin/network — re-validate against live services.
  const options = await getPayOptions();
  const chosen = options.find(
    (o) =>
      o.currency === params.currency.toUpperCase() &&
      o.network.toLowerCase() === params.network.toLowerCase()
  );
  if (!chosen) throw new Error('That coin/network is not available.');

  // For stablecoins we can compare Heleket's minimum to USD directly.
  if (chosen.minUsd !== null && usdAmount < chosen.minUsd) {
    throw new Error(`Minimum for ${chosen.currency} on ${chosen.network} is $${chosen.minUsd}.`);
  }

  const rate = await getEffectiveRate(5);
  if (!rate) throw new Error('Crypto top-up is unavailable right now (no exchange rate set).');

  // Estimate shown to the customer. The webhook recomputes from what actually
  // arrived, net of Heleket's commission.
  const estimatedNetUsd = usdAmount * (1 - chosen.commissionPercent / 100);
  const mmkEstimate = Math.floor(estimatedNetUsd * rate.effectiveRate);

  const supabase = getServiceSupabaseClient();

  // Insert FIRST so we always have a record even if Heleket fails mid-call.
  const { data: inserted, error: insertErr } = await supabase
    .from('crypto_topups')
    .insert({
      user_id: params.userId,
      usd_amount: usdAmount,
      pay_currency: chosen.currency,
      network: chosen.network,
      rate: rate.effectiveRate,
      mmk_amount: mmkEstimate,
      status: 'CREATED',
      expires_at: new Date(Date.now() + INVOICE_LIFETIME_SEC * 1000).toISOString(),
    })
    .select('*')
    .maybeSingle();

  if (insertErr || !inserted) {
    console.error('[cryptoTopup] insert failed:', insertErr);
    throw new Error('Could not start the top-up. Please try again.');
  }

  const row: any = inserted;

  try {
    const invoice = await createInvoice({
      usdAmount,
      orderId: row.id, // uuid — matches Heleket's alpha_dash rule
      toCurrency: chosen.currency,
      network: chosen.network,
      callbackUrl: `${params.siteUrl.replace(/\/$/, '')}/api/crypto/webhook`,
      lifetimeSec: INVOICE_LIFETIME_SEC,
    });

    const { data: updated, error: updErr } = await supabase
      .from('crypto_topups')
      .update({
        invoice_uuid: invoice.uuid,
        pay_address: invoice.address,
        pay_amount: invoice.payer_amount ? Number(invoice.payer_amount) : null,
        pay_url: invoice.url,
        status: 'WAITING',
      })
      .eq('id', row.id)
      .select('*')
      .maybeSingle();

    if (updErr || !updated) throw new Error('Could not save the invoice.');
    return updated as CryptoTopupRow;
  } catch (err: any) {
    console.error('[cryptoTopup] Heleket createInvoice failed:', err);
    await supabase.from('crypto_topups').update({ status: 'FAILED' }).eq('id', row.id);
    throw new Error(err?.message || 'Payment provider unavailable. Please try again.');
  }
}

/**
 * Credit a confirmed top-up.
 *
 * netUsd is derived from what ACTUALLY arrived:
 *     netUsd = payment_amount_usd * (merchant_amount / payment_amount)
 *
 * That ratio is Heleket's commission, expressed in whatever coin was paid. It
 * works for stablecoins and volatile coins alike, and it means an overpayment
 * credits more and an underpayment credits less — automatically, with no
 * special-casing.
 */
export async function creditCryptoTopup(
  topupId: string,
  webhook: {
    payment_amount?: string | number;
    payment_amount_usd?: string | number;
    merchant_amount?: string | number;
  }
): Promise<{ credited: boolean; reason: string; mmk?: number }> {
  const supabase = getServiceSupabaseClient();

  // Atomic claim — a webhook retry finds nothing and safely no-ops.
  const { data: claimed, error: claimErr } = await supabase
    .from('crypto_topups')
    .update({ credited: true, status: 'CREDITED' })
    .eq('id', topupId)
    .eq('credited', false)
    .select('id,user_id,rate,usd_amount')
    .maybeSingle();

  if (claimErr) throw claimErr;
  if (!claimed) return { credited: false, reason: 'already_credited' };

  const t: any = claimed;
  const lockedRate = Number(t.rate);

  const paymentAmount = Number(webhook.payment_amount ?? 0);
  const merchantAmount = Number(webhook.merchant_amount ?? 0);
  const paymentUsd = Number(webhook.payment_amount_usd ?? 0);

  // Net USD after Heleket's commission — this is what the customer really gave us.
  let netUsd: number;
  if (paymentAmount > 0 && merchantAmount > 0 && paymentUsd > 0) {
    netUsd = paymentUsd * (merchantAmount / paymentAmount);
  } else if (paymentUsd > 0) {
    netUsd = paymentUsd; // commission data missing — don't invent it
  } else {
    // Nothing usable. Release the claim rather than credit a guess.
    await supabase
      .from('crypto_topups')
      .update({ credited: false, status: 'CONFIRMED' })
      .eq('id', topupId);
    throw new Error('Webhook had no usable amount — refusing to credit a guessed value.');
  }

  const amount = Math.floor(netUsd * lockedRate);
  if (!Number.isFinite(amount) || amount <= 0) {
    await supabase
      .from('crypto_topups')
      .update({ credited: false, status: 'CONFIRMED' })
      .eq('id', topupId);
    throw new Error(`Computed a non-positive credit (${amount}) — refusing.`);
  }

  try {
    const { data: walletRow, error: wErr } = await supabase
      .from('wallets')
      .select('id,balance')
      .eq('user_id', t.user_id)
      .maybeSingle();
    if (wErr) throw wErr;

    let walletId: string;
    if (!walletRow) {
      const { data: nw, error: cErr } = await supabase
        .from('wallets')
        .insert({ user_id: t.user_id, balance: amount })
        .select('id')
        .maybeSingle();
      if (cErr) throw cErr;
      walletId = (nw as any).id;
    } else {
      walletId = (walletRow as any).id;
      const current = Number((walletRow as any).balance ?? 0);
      const { error: uErr } = await supabase
        .from('wallets')
        .update({ balance: current + amount })
        .eq('id', walletId);
      if (uErr) throw uErr;
    }

    const { error: txErr } = await supabase.from('wallet_transactions').insert({
      wallet_id: walletId,
      amount,
      direction: 'CREDIT',
      description: `Crypto top-up ($${netUsd.toFixed(2)} net)`,
    });
    if (txErr) throw txErr;

    // Record what we actually credited.
    await supabase
      .from('crypto_topups')
      .update({ mmk_amount: amount, net_usd: netUsd })
      .eq('id', topupId);

    return { credited: true, reason: 'credited', mmk: amount };
  } catch (err) {
    // Crediting failed AFTER claiming — release so a retry can succeed, rather
    // than leaving the customer paid-but-uncredited.
    console.error('[cryptoTopup] crediting failed, releasing claim', err);
    await supabase
      .from('crypto_topups')
      .update({ credited: false, status: 'CONFIRMED' })
      .eq('id', topupId);
    throw err;
  }
}

export async function getCryptoTopupById(
  id: string,
  userId: string
): Promise<CryptoTopupRow | null> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data } = await supabase
      .from('crypto_topups')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();
    return (data as CryptoTopupRow) ?? null;
  } catch {
    return null;
  }
}
