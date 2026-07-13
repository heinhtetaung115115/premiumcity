// lib/heleket.ts
// Heleket crypto payment gateway client.
// Docs: https://doc.heleket.com
//
// Env:
//   HELEKET_MERCHANT_ID       — merchant UUID
//   HELEKET_PAYMENT_API_KEY   — payment API key (NOT the payout key)

import crypto from 'crypto';

const MERCHANT_ID = process.env.HELEKET_MERCHANT_ID || '';
const PAYMENT_API_KEY = process.env.HELEKET_PAYMENT_API_KEY || '';
const BASE = 'https://api.heleket.com/v1';

/**
 * Heleket signs the JSON body the way PHP does — and PHP ESCAPES FORWARD
 * SLASHES. JavaScript's JSON.stringify does not. If we don't escape them, the
 * hash never matches and EVERY webhook is rejected.
 *
 * Heleket's own docs call this out explicitly. It bites everyone once.
 */
function phpStyleJson(data: unknown): string {
  return JSON.stringify(data).replace(/\//g, '\\/');
}

/** sign = md5( base64(json_body) + API_KEY ) */
function makeSign(bodyJson: string, key: string): string {
  const b64 = Buffer.from(bodyJson, 'utf8').toString('base64');
  return crypto.createHash('md5').update(b64 + key).digest('hex');
}

async function helFetch<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  if (!MERCHANT_ID || !PAYMENT_API_KEY) {
    throw new Error('Heleket is not configured (HELEKET_MERCHANT_ID / HELEKET_PAYMENT_API_KEY)');
  }

  const json = phpStyleJson(body);
  const sign = makeSign(json, PAYMENT_API_KEY);

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      merchant: MERCHANT_ID,
      sign,
      'Content-Type': 'application/json',
    },
    body: json,
    cache: 'no-store',
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Heleket ${path}: non-JSON response (HTTP ${res.status})`);
  }

  // Heleket signals errors with state:1 even on HTTP 200.
  if (!res.ok || parsed?.state === 1) {
    const msg = parsed?.message || parsed?.errors || `HTTP ${res.status}`;
    throw new Error(`Heleket ${path}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
  }

  return parsed?.result as T;
}

// ─────────────────────────────────────────────────────────────
// SERVICES — live networks, minimums and commissions
// ─────────────────────────────────────────────────────────────
export type HeleketService = {
  network: string;
  currency: string;
  is_available: boolean;
  limit: { min_amount: string; max_amount: string };
  commission: { fee_amount: string; percent: string };
};

export async function getServices(): Promise<HeleketService[]> {
  const result = await helFetch<HeleketService[]>('/payment/services', {});
  return Array.isArray(result) ? result : [];
}

/**
 * Coins we offer. USDT across every major network, plus the coins people
 * actually hold. Anything not listed here is hidden even if Heleket supports
 * it — a shorter list means fewer ways for a customer to send funds wrong.
 */
const ALLOWED_CURRENCIES = new Set([
  'USDT',
  'USDC',
  'BTC',
  'ETH',
  'BNB',
  'TRX',
  'LTC',
  'SOL',
  'TON',
  'DOGE',
  'POL',
  'MATIC',
  'AVAX',
]);

/** Stablecoins: 1 unit ≈ 1 USD, so their min_amount can be compared to USD. */
const STABLECOINS = new Set(['USDT', 'USDC', 'DAI']);

export type PayOption = {
  currency: string;
  network: string;
  /** Minimum in the COIN's own units (per Heleket). */
  minAmount: number;
  /** Only meaningful for stablecoins — otherwise null. */
  minUsd: number | null;
  commissionPercent: number;
  isStable: boolean;
};

export function toPayOptions(services: HeleketService[]): PayOption[] {
  return services
    .filter((s) => s.is_available && ALLOWED_CURRENCIES.has(s.currency.toUpperCase()))
    .map((s) => {
      const currency = s.currency.toUpperCase();
      const isStable = STABLECOINS.has(currency);
      const minAmount = Number(s.limit?.min_amount ?? 0);
      return {
        currency,
        network: s.network,
        minAmount,
        // For a volatile coin the min is in coin units, NOT dollars — we must
        // not pretend otherwise, so we leave it null rather than guess.
        minUsd: isStable && Number.isFinite(minAmount) ? minAmount : null,
        commissionPercent: Number(s.commission?.percent ?? 0),
        isStable,
      };
    })
    .sort((a, b) => {
      // Stablecoins first (predictable minimums), then alphabetical.
      if (a.isStable !== b.isStable) return a.isStable ? -1 : 1;
      if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
      return a.network.localeCompare(b.network);
    });
}

// ─────────────────────────────────────────────────────────────
// CREATE INVOICE
// ─────────────────────────────────────────────────────────────
export type HeleketInvoice = {
  uuid: string;
  order_id: string;
  amount: string;
  payment_amount: string | null;
  payer_amount: string | null;
  payer_currency: string | null;
  currency: string;
  network: string | null;
  address: string | null;
  payment_status: string;
  url: string;
  expired_at: number | null;
};

/**
 * Create an invoice priced in USD, payable in a specific coin+network.
 *
 * Passing BOTH to_currency and network is what makes Heleket allocate an
 * address up front — otherwise the customer would have to pick the coin on
 * Heleket's own page.
 */
export async function createInvoice(params: {
  usdAmount: number;
  orderId: string;
  toCurrency: string;
  network: string;
  callbackUrl: string;
  lifetimeSec?: number;
}): Promise<HeleketInvoice> {
  return helFetch<HeleketInvoice>('/payment', {
    amount: String(params.usdAmount),
    currency: 'USD',
    order_id: params.orderId, // alpha_dash only — a UUID is fine
    to_currency: params.toCurrency,
    network: params.network,
    url_callback: params.callbackUrl,
    lifetime: params.lifetimeSec ?? 3600,
  });
}

export async function getInvoice(uuid: string): Promise<HeleketInvoice> {
  return helFetch<HeleketInvoice>('/payment/info', { uuid });
}

// ─────────────────────────────────────────────────────────────
// WEBHOOK VERIFICATION — the security boundary
// ─────────────────────────────────────────────────────────────
//
// Heleket puts `sign` INSIDE the body (not a header). To verify: remove sign,
// re-hash what's left, compare.
//
// Without this check, anyone who learns the webhook URL could POST a fake
// "paid" event and mint themselves unlimited wallet balance. Never credit from
// an unverified webhook.
export function verifyWebhookSign(body: Record<string, any>): boolean {
  if (!PAYMENT_API_KEY) {
    console.error('[heleket] HELEKET_PAYMENT_API_KEY missing — rejecting webhook');
    return false;
  }

  const sign = body?.sign;
  if (typeof sign !== 'string' || !sign) return false;

  // Everything EXCEPT sign is what was hashed.
  const { sign: _omit, ...rest } = body;

  const expected = makeSign(phpStyleJson(rest), PAYMENT_API_KEY);

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(sign, 'utf8');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

/** Heleket's webhook source IP — a cheap second layer on top of the signature. */
export const HELEKET_WEBHOOK_IP = '31.133.220.8';

/** Money has arrived and is ours. */
export function isPaidStatus(status: string): boolean {
  return status === 'paid' || status === 'paid_over';
}

/** This invoice will never complete. */
export function isDeadStatus(status: string): boolean {
  return (
    status === 'fail' ||
    status === 'cancel' ||
    status === 'system_fail' ||
    status === 'wrong_amount_waiting' ||
    status.startsWith('refund')
  );
}
