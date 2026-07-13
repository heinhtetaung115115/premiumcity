// lib/cryptoRate.ts
// ─────────────────────────────────────────────────────────────
// MMK per 1 USDT.
//
// HOW PRICING ACTUALLY WORKS HERE:
//
//   Your MANUAL rate is the final word. It is used EXACTLY as typed — no
//   margin is deducted. The Bybit feed below is REFERENCE ONLY: it exists to
//   inform your daily decision, never to price a customer on its own.
//
//   That is deliberate. Bybit's P2P endpoint is internal and undocumented; it
//   can change shape or start blocking us without notice. An undocumented
//   scraper must never silently decide how much money a customer receives.
//
// WHICH SIDE?
//
//   You RECEIVE usdt from a customer and must SELL it for MMK. So the number
//   that matters is what a merchant will PAY YOU for usdt — the SELL side.
//   SELL should always sit BELOW buy; the gap is the market spread. The admin
//   table shows both and flags an inversion, because getting this backwards
//   would mean crediting more than you can cash out.
// ─────────────────────────────────────────────────────────────

import { getServiceSupabaseClient } from '@/lib/supabase';

const MIN_SANE_RATE = 1000;
const MAX_SANE_RATE = 20000;
const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;

export type Side = 'SELL' | 'BUY';

export type RateSourceResult = {
  source: string;
  side: Side;
  ok: boolean;
  rate: number | null;
  detail: string;
};

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function sane(r: number): boolean {
  return Number.isFinite(r) && r >= MIN_SANE_RATE && r <= MAX_SANE_RATE;
}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────
export type RateSettings = {
  manualEnabled: boolean;
  manualUsdtMmk: number | null;
  /** Bybit payment-method IDs. Empty = all methods (a blended average). */
  payTypes: string[];
  updatedAt: string | null;
};

export async function getRateSettings(): Promise<RateSettings> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data } = await supabase
      .from('crypto_rate_settings')
      .select('manual_enabled,manual_usdt_mmk,pay_types,updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (!data) {
      return { manualEnabled: false, manualUsdtMmk: null, payTypes: [], updatedAt: null };
    }
    const d: any = data;
    return {
      manualEnabled: !!d.manual_enabled,
      manualUsdtMmk: d.manual_usdt_mmk === null ? null : Number(d.manual_usdt_mmk),
      payTypes: Array.isArray(d.pay_types) ? d.pay_types.map(String) : [],
      updatedAt: d.updated_at ?? null,
    };
  } catch (err) {
    console.error('[cryptoRate] getRateSettings failed:', err);
    return { manualEnabled: false, manualUsdtMmk: null, payTypes: [], updatedAt: null };
  }
}

export async function saveRateSettings(s: {
  manualEnabled: boolean;
  manualUsdtMmk: number | null;
  payTypes: string[];
}) {
  const supabase = getServiceSupabaseClient();
  const now = new Date().toISOString();

  // Our custom Supabase client has NO .upsert() — select then update-or-insert.
  const { data: existing } = await supabase
    .from('crypto_rate_settings')
    .select('id')
    .eq('id', 1)
    .maybeSingle();

  const row = {
    manual_enabled: s.manualEnabled,
    manual_usdt_mmk: s.manualUsdtMmk,
    pay_types: s.payTypes,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabase.from('crypto_rate_settings').update(row).eq('id', 1);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('crypto_rate_settings').insert({ id: 1, ...row });
    if (error) throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// BYBIT P2P — the only source
// ─────────────────────────────────────────────────────────────
//
// Internal, undocumented endpoint. `side` is a string and its meaning is not
// documented anywhere — that is why the admin table shows BOTH sides, so you
// can check them against the Bybit app once and be certain.
export async function fetchBybitP2P(
  side: Side = 'SELL',
  payTypes: string[] = []
): Promise<RateSourceResult> {
  const source = 'bybit_p2p';
  const bybitSide = side === 'SELL' ? '0' : '1';

  try {
    const res = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
        Origin: 'https://www.bybit.com',
      },
      body: JSON.stringify({
        userId: '',
        tokenId: 'USDT',
        currencyId: 'MMK',
        payment: payTypes, // [] = every method
        side: bybitSide,
        size: '20',
        page: '1',
        amount: '',
        authMaker: false,
        canTrade: false,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { source, side, ok: false, rate: null, detail: `HTTP ${res.status}` };
    }

    const json: any = await res.json();
    const items: any[] = json?.result?.items ?? [];
    const prices = items
      .map((i) => Number(i?.price))
      .filter((p) => Number.isFinite(p) && p > 0);

    if (prices.length < 3) {
      return {
        source,
        side,
        ok: false,
        rate: null,
        detail:
          payTypes.length > 0
            ? `only ${prices.length} ads for the selected payment method — try clearing the filter`
            : `only ${prices.length} usable ads`,
      };
    }

    const rate = median(prices.slice(0, 10));
    if (!sane(rate)) {
      return { source, side, ok: false, rate, detail: `rate ${rate} outside sane bounds` };
    }

    return {
      source,
      side,
      ok: true,
      rate,
      detail: `median of ${Math.min(prices.length, 10)} ads${
        payTypes.length ? ' (filtered)' : ' (all methods)'
      }`,
    };
  } catch (err: any) {
    return { source, side, ok: false, rate: null, detail: `threw: ${err?.message ?? err}` };
  }
}

export type PaymentMethod = { id: string; name: string };

/**
 * Bybit's payment-method list, so you can price against the method you
 * actually cash out with (KBZ Pay and bank transfer differ in Myanmar).
 * Best-effort — returns [] if the shape changes.
 */
export async function fetchBybitPaymentMethods(): Promise<PaymentMethod[]> {
  try {
    const res = await fetch(
      'https://api2.bybit.com/fiat/otc/configuration/queryAllPaymentList',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
          Origin: 'https://www.bybit.com',
        },
        body: JSON.stringify({}),
        cache: 'no-store',
      }
    );
    if (!res.ok) return [];

    const json: any = await res.json();
    const list: any[] = json?.result?.paymentConfigVo ?? json?.result ?? [];
    if (!Array.isArray(list)) return [];

    return list
      .map((p) => ({
        id: String(p?.paymentType ?? p?.id ?? ''),
        name: String(p?.paymentName ?? p?.name ?? ''),
      }))
      .filter((p) => p.id && p.name);
  } catch (err) {
    console.error('[cryptoRate] fetchBybitPaymentMethods failed:', err);
    return [];
  }
}

export type SourcePair = { source: string; sell: RateSourceResult; buy: RateSourceResult };

/** Reference rates — both sides. NEVER used to price a customer directly. */
export async function probeReferenceRates(payTypes: string[] = []): Promise<SourcePair[]> {
  const [sell, buy] = await Promise.all([
    fetchBybitP2P('SELL', payTypes),
    fetchBybitP2P('BUY', payTypes),
  ]);
  return [{ source: 'bybit_p2p', sell, buy }];
}

// ─────────────────────────────────────────────────────────────
// STORED RATES (auto feed — fallback only)
// ─────────────────────────────────────────────────────────────
export type StoredRate = { usdtMmk: number; source: string; createdAt: string };

export async function getLatestStoredRate(): Promise<StoredRate | null> {
  const supabase = getServiceSupabaseClient();
  try {
    const { data } = await supabase
      .from('crypto_rates')
      .select('usdt_mmk,source,created_at')
      .order('created_at', { ascending: false })
      .limit(1);
    const row: any = (data ?? [])[0];
    if (!row) return null;
    return {
      usdtMmk: Number(row.usdt_mmk),
      source: String(row.source ?? 'unknown'),
      createdAt: String(row.created_at),
    };
  } catch (err) {
    console.error('[cryptoRate] getLatestStoredRate failed:', err);
    return null;
  }
}

/**
 * Cron: store the Bybit SELL rate as a fallback.
 *
 * Deliberately SILENT on failure — you asked for one alert a day, not noise.
 * The 9 AM reminder reports feed health, and your manual rate is what
 * actually prices top-ups anyway, so a failed fetch is not an emergency.
 */
export async function refreshCryptoRate(): Promise<{
  ok: boolean;
  rate?: number;
  message: string;
  probes: RateSourceResult[];
}> {
  const settings = await getRateSettings();
  const probe = await fetchBybitP2P('SELL', settings.payTypes);

  if (!probe.ok || probe.rate === null) {
    return {
      ok: false,
      message: `bybit_p2p: ${probe.detail}`,
      probes: [probe],
    };
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('crypto_rates')
    .insert({ usdt_mmk: probe.rate, source: 'bybit_p2p' });

  if (error) {
    return {
      ok: false,
      rate: probe.rate,
      message: `DB insert failed: ${error.message}`,
      probes: [probe],
    };
  }

  return {
    ok: true,
    rate: probe.rate,
    message: `Stored ${probe.rate} MMK/USDT (bybit SELL)`,
    probes: [probe],
  };
}

/**
 * The rate the storefront uses.
 *
 * MANUAL WINS, and it is used EXACTLY as typed — no margin deducted. You have
 * already priced your margin into the number.
 *
 * The auto feed (with a margin) is only a fallback for when no manual rate is
 * set. Returns null if nothing usable exists — callers MUST then disable
 * crypto top-ups rather than invent a rate.
 */
export async function getEffectiveRate(marginPercent = 5): Promise<{
  marketRate: number;
  effectiveRate: number;
  source: string;
  isManual: boolean;
  ageMs: number;
} | null> {
  const settings = await getRateSettings();

  if (settings.manualEnabled && settings.manualUsdtMmk && sane(settings.manualUsdtMmk)) {
    return {
      marketRate: settings.manualUsdtMmk,
      effectiveRate: Math.floor(settings.manualUsdtMmk), // exact — no cut
      source: 'manual',
      isManual: true,
      ageMs: settings.updatedAt ? Date.now() - new Date(settings.updatedAt).getTime() : 0,
    };
  }

  const stored = await getLatestStoredRate();
  if (!stored || !sane(stored.usdtMmk)) return null;

  const ageMs = Date.now() - new Date(stored.createdAt).getTime();
  if (ageMs > MAX_RATE_AGE_MS) return null;

  return {
    marketRate: stored.usdtMmk,
    effectiveRate: Math.floor(stored.usdtMmk * (1 - marginPercent / 100)),
    source: stored.source,
    isManual: false,
    ageMs,
  };
}
