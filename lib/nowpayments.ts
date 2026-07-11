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

/**
 * YOUR payout / outcome wallet currency — the coin NOWPayments settles to.
 *
 * THIS DRIVES THE MINIMUMS. NOWPayments swaps whatever the customer sends into
 * this currency, and the minimum it enforces is for the pair
 * (pay currency -> payout currency), NOT the pay currency on its own.
 *
 * Querying a mono pair (usdterc20 -> usdterc20) returns a meaningless
 * self-swap minimum. That is why Ethereum once showed a $0.55 minimum while
 * NOWPayments actually rejected anything under ~$12.
 *
 * Set NOWPAYMENTS_PAYOUT_CURRENCY to whatever coin your NOWPayments outcome
 * wallet is set to.
 */
export const PAYOUT_CURRENCY =
  process.env.NOWPAYMENTS_PAYOUT_CURRENCY || 'usdttrc20';

/** Padding on the reported minimum, to survive rounding at the boundary. */
const MIN_BUFFER = 0.03; // 3%

/**
 * Networks the customer can pay on.
 *
 * Each has a DIFFERENT minimum on NOWPayments, driven by that chain's fees.
 * We fetch the real minimum per network at runtime rather than hard-coding —
 * a payment below NOWPayments' minimum will not process, and the customer
 * would lose the funds to a stuck invoice.
 *
 * `code` must match NOWPayments' currency ticker exactly.
 */
export type PayNetwork = {
  code: string;
  label: string;
  network: string;
  note: string;
};

export const PAY_NETWORKS: PayNetwork[] = [
  {
    code: 'usdttrc20',
    label: 'USDT',
    network: 'Tron (TRC-20)',
    note: 'Cheapest fees — recommended',
  },
  {
    code: 'usdtbsc',
    label: 'USDT',
    network: 'BNB Smart Chain (BEP-20)',
    note: 'Low fees',
  },
  {
    code: 'usdtsol',
    label: 'USDT',
    network: 'Solana',
    note: 'Fast, low fees',
  },
  {
    code: 'usdtmatic',
    label: 'USDT',
    network: 'Polygon',
    note: 'Low fees',
  },
  {
    code: 'usdtarb',
    label: 'USDT',
    network: 'Arbitrum',
    note: 'Low fees',
  },
  {
    code: 'usdterc20',
    label: 'USDT',
    network: 'Ethereum (ERC-20)',
    note: 'High gas fees — higher minimum',
  },
  {
    code: 'usdcsol',
    label: 'USDC',
    network: 'Solana',
    note: 'Fast, low fees',
  },
  {
    code: 'usdcbsc',
    label: 'USDC',
    network: 'BNB Smart Chain',
    note: 'Low fees',
  },
];

export function findNetwork(code: string): PayNetwork | undefined {
  return PAY_NETWORKS.find((n) => n.code === code);
}

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
  currencyTo: string = PAYOUT_CURRENCY
): Promise<number | null> {
  try {
    const json = await npFetch(
      `/min-amount?currency_from=${encodeURIComponent(currencyFrom)}` +
        `&currency_to=${encodeURIComponent(currencyTo)}` +
        `&fiat_equivalent=usd`
    );

    // Prefer the USD figure when NOWPayments returns one — our pay currencies
    // are all USD stablecoins, but this keeps the number honest if that ever
    // changes.
    const fiat = Number(json?.fiat_equivalent);
    const raw = Number(json?.min_amount);
    const base = Number.isFinite(fiat) && fiat > 0 ? fiat : raw;

    if (!Number.isFinite(base) || base <= 0) return null;

    // Safety buffer. NOWPayments rejected a payment quoted at exactly the
    // reported minimum ("Crypto amount 4.996917 is less than minimal") because
    // the USD->crypto conversion lands a hair under the limit. Pad it so a
    // customer paying our stated minimum is never rejected at the boundary.
    return base * (1 + MIN_BUFFER);
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
  payCurrency?: string;
  orderDescription?: string;
  ipnCallbackUrl?: string;
}): Promise<CreatedPayment> {
  const body: Record<string, unknown> = {
    price_amount: params.priceAmount,
    price_currency: 'usd',
    pay_currency: params.payCurrency || PAY_CURRENCY,
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

export type NetworkOption = PayNetwork & {
  /** Real minimum from NOWPayments, in USD terms. null = couldn't fetch. */
  minUsd: number | null;
  available: boolean;
};

/**
 * Fetch the live minimum for every supported network, in parallel.
 *
 * We ask NOWPayments for the minimum in the pay-currency itself. Because our
 * accepted coins are all USD stablecoins, that number is ~USD 1:1, which is
 * what we show the customer.
 *
 * A network whose minimum can't be fetched is marked unavailable rather than
 * guessed at — quoting a wrong minimum means stuck payments.
 */
export async function getNetworkOptions(): Promise<NetworkOption[]> {
  const results = await Promise.all(
    PAY_NETWORKS.map(async (n) => {
      try {
        const min = await getMinAmount(n.code, PAYOUT_CURRENCY);
        if (min === null || !Number.isFinite(min) || min <= 0) {
          return { ...n, minUsd: null, available: false };
        }
        return {
          ...n,
          minUsd: Math.ceil(min * 100) / 100,
          available: true,
        };
      } catch {
        return { ...n, minUsd: null, available: false };
      }
    })
  );

  // Cheapest minimum first — that's what the customer cares about.
  return results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return (a.minUsd ?? 9e9) - (b.minUsd ?? 9e9);
  });
}
