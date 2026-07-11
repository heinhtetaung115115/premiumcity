// lib/nowpayments.ts
//
// NOWPayments API client.
//
// Env vars required:
//   NOWPAYMENTS_API_KEY     - from nowpayments.io dashboard
//   NOWPAYMENTS_IPN_SECRET  - from dashboard (Settings -> IPN)
//
// We deliberately restrict payments to USDT on TRON (usdttrc20) because the
// network fee is a few cents, which is what makes a $5 minimum viable.
// BTC/ERC-20 minimums are far higher (~$12+).

import crypto from 'crypto';

const API_BASE = 'https://api.nowpayments.io/v1';

export const PAY_CURRENCY = 'usdttrc20';

function apiKey(): string {
  const k = process.env.NOWPAYMENTS_API_KEY || '';
  if (!k) throw new Error('NOWPAYMENTS_API_KEY not configured');
  return k;
}

async function npFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': apiKey(),
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response
  }

  if (!res.ok) {
    const msg = json?.message || json?.error || text || `HTTP ${res.status}`;
    console.error(`[nowpayments] ${path} failed: ${res.status} ${msg}`);
    throw new Error(`NOWPayments error (${res.status}): ${msg}`);
  }

  return json;
}

/** Health check — returns true if the API is reachable. */
export async function getStatus(): Promise<boolean> {
  try {
    const json = await npFetch('/status');
    return json?.message === 'OK';
  } catch {
    return false;
  }
}

/**
 * Minimum payment amount for a currency pair, in the *from* currency.
 * We use this to enforce our own floor so we never create an invoice
 * that physically cannot complete.
 */
export async function getMinAmount(
  currencyFrom: string = PAY_CURRENCY,
  currencyTo: string = PAY_CURRENCY
): Promise<number | null> {
  try {
    const json = await npFetch(
      `/min-amount?currency_from=${encodeURIComponent(currencyFrom)}&currency_to=${encodeURIComponent(currencyTo)}`
    );
    const v = Number(json?.min_amount);
    return Number.isFinite(v) ? v : null;
  } catch (err) {
    console.error('[nowpayments] getMinAmount failed:', err);
    return null;
  }
}

export type CreatedPayment = {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  status: string;
};

/**
 * Create a payment. `orderId` is OUR reference — the webhook echoes it back,
 * which is how we match a confirmation to a crypto_topups row.
 */
export async function createPayment(params: {
  priceAmount: number; // in USD
  orderId: string;
  orderDescription?: string;
  ipnCallbackUrl?: string;
}): Promise<CreatedPayment> {
  const body: Record<string, unknown> = {
    price_amount: params.priceAmount,
    price_currency: 'usd',
    pay_currency: PAY_CURRENCY,
    order_id: params.orderId,
    order_description: params.orderDescription ?? 'Wallet top-up',
  };
  if (params.ipnCallbackUrl) body.ipn_callback_url = params.ipnCallbackUrl;

  const json = await npFetch('/payment', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    paymentId: String(json.payment_id),
    payAddress: String(json.pay_address),
    payAmount: Number(json.pay_amount),
    payCurrency: String(json.pay_currency),
    status: String(json.payment_status),
  };
}

/** Fetch the live status of a payment (used as a fallback if the IPN is missed). */
export async function getPayment(paymentId: string): Promise<any> {
  return npFetch(`/payment/${encodeURIComponent(paymentId)}`);
}

/**
 * Verify a NOWPayments IPN callback.
 *
 * NOWPayments signs the request with HMAC-SHA512 over the JSON body with its
 * keys sorted alphabetically, using the IPN secret. The signature arrives in
 * the `x-nowpayments-sig` header.
 *
 * SECURITY: never credit a wallet on an unverified callback — anyone can POST
 * to the webhook URL.
 */
export function verifyIpnSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || '';
  if (!secret) {
    console.error('[nowpayments] NOWPAYMENTS_IPN_SECRET not configured — rejecting IPN');
    return false;
  }
  if (!signature) return false;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  // Re-serialize with sorted keys, exactly as NOWPayments does when signing.
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort());

  const expected = crypto.createHmac('sha512', secret).update(sorted).digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
