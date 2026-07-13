// lib/cryptoRate.ts
// ─────────────────────────────────────────────────────────────
// MMK per 1 USDT rate engine.
//
// WHICH SIDE OF THE BOOK? (this is the thing to get right)
//
//   You RECEIVE USDT from a customer and you must SELL it for MMK.
//   So the rate that matters is what a merchant will PAY YOU for USDT.
//   That is the SELL side (you are the seller).
//
//   The sell price is always LOWER than the buy price — that gap is the
//   market's spread. If you ever see our "sell" number come out HIGHER
//   than our "buy" number, the sides are inverted and you are crediting
//   customers too much. The admin page shows BOTH so you can eyeball it
//   against the real Binance app.
//
// PAYMENT METHOD MATTERS
//
//   KBZ Pay, bank transfer, Wave and AYA trade at DIFFERENT rates in
//   Myanmar. Leaving payTypes empty blends them all into one average that
//   matches none of them. Set pay_types in crypto_rate_settings to the
//   method you ACTUALLY cash out with.
//
// OTHER SAFETY (unchanged):
//   • median of top ads — one fake ad can't move the rate
//   • deviation guard — a broken feed can't silently 10x what we credit
//   • manual override — the business never depends on a scraper
//   • storefront reads a STORED rate, never a live fetch at checkout
// ─────────────────────────────────────────────────────────────

import { getServiceSupabaseClient } from '@/lib/supabase';

const MAX_DEVIATION = 0.1;
const MIN_SANE_RATE = 1000;
const MAX_SANE_RATE = 20000;
const MAX_RATE_AGE_MS = 24 * 60 * 60 * 1000;

/** SELL = we sell USDT for MMK (what we need). BUY = shown only for comparison. */
export type Side = 'SELL' | 'BUY';

export type RateSourceResult = {
  source: string;
  side: Side;
  ok: boolean;
  rate: number | null;
  detail: string;
  /** Payment methods seen in the ads we sampled — used to populate the filter. */
  payTypesSeen?: string[];
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
// SETTINGS (manual override + payment-method filter)
// ─────────────────────────────────────────────────────────────
export type RateSettings = {
  manualEnabled: boolean;
  manualUsdtMmk: number | null;
  /** Binance payType identifiers, e.g. ["KBZPay"]. Empty = all methods. */
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
      payTypes: Array.isArray(d.pay_types) ? d.pay_types : [],
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
    const { error } = await supabase
      .from('crypto_rate_settings')
      .insert({ id: 1, ...row });
    if (error) throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// SOURCE 1 — BINANCE P2P
// ─────────────────────────────────────────────────────────────
//
// tradeType is the action WE take:
//   'SELL' -> ads from merchants who will BUY our USDT  <-- the rate we need
//   'BUY'  -> ads from merchants selling USDT to us
export async function fetchBinanceP2P(
  side: Side = 'SELL',
  payTypes: string[] = []
): Promise<RateSourceResult> {
  const source = 'binance_p2p';
  try {
    const res = await fetch(
      'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
          Origin: 'https://p2p.binance.com',
        },
        body: JSON.stringify({
          asset: 'USDT',
          fiat: 'MMK',
          tradeType: side,
          page: 1,
          rows: 20,
          payTypes, // [] = every method (a blended average — usually NOT what you want)
          publisherType: null,
        }),
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      const hint =
        res.status === 451
          ? ' (GEO-BLOCKED — Binance blocks US IPs. vercel.json must pin regions to sin1.)'
          : '';
      return { source, side, ok: false, rate: null, detail: `HTTP ${res.status}${hint}` };
    }

    const json: any = await res.json();
    const ads: any[] = json?.data ?? [];

    // Every payment method offered across the sampled ads — this is what
    // populates the filter dropdown in admin.
    const payTypesSeen = Array.from(
      new Set(
        ads.flatMap((a) =>
          (a?.adv?.tradeMethods ?? [])
            .map((m: any) => m?.identifier)
            .filter((x: any) => typeof x === 'string')
        )
      )
    );

    const prices = ads
      .map((a) => Number(a?.adv?.price))
      .filter((p) => Number.isFinite(p) && p > 0);

    if (prices.length < 3) {
      return {
        source,
        side,
        ok: false,
        rate: null,
        detail:
          payTypes.length > 0
            ? `only ${prices.length} ads for the selected payment method — try removing the filter`
            : `only ${prices.length} usable ads`,
        payTypesSeen,
      };
    }

    const rate = median(prices.slice(0, 10));
    if (!sane(rate)) {
      return { source, side, ok: false, rate, detail: `rate ${rate} outside sane bounds`, payTypesSeen };
    }

    return {
      source,
      side,
      ok: true,
      rate,
      detail: `median of ${Math.min(prices.length, 10)} ads${payTypes.length ? ` (${payTypes.join(', ')})` : ' (all methods)'}`,
      payTypesSeen,
    };
  } catch (err: any) {
    return { source, side, ok: false, rate: null, detail: `threw: ${err?.message ?? err}` };
  }
}

// ─────────────────────────────────────────────────────────────
// SOURCE 2 — BYBIT P2P
// ─────────────────────────────────────────────────────────────
//
// Internal, undocumented endpoint (same category as Binance's).
// Bybit's `side` is a string: we read both and let you compare, because the
// semantics are not documented and I will not guess with your money.
export async function fetchBybitP2P(side: Side = 'SELL'): Promise<RateSourceResult> {
  const source = 'bybit_p2p';
  // Bybit: "0" and "1" name the ad book. To SELL our USDT we want the ads of
  // merchants who are BUYING. Verify against the app using the admin table.
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
        payment: [],
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
      return { source, side, ok: false, rate: null, detail: `only ${prices.length} usable ads` };
    }

    const rate = median(prices.slice(0, 10));
    if (!sane(rate)) {
      return { source, side, ok: false, rate, detail: `rate ${rate} outside sane bounds` };
    }

    return { source, side, ok: true, rate, detail: `median of ${Math.min(prices.length, 10)} ads` };
  } catch (err: any) {
    return { source, side, ok: false, rate: null, detail: `threw: ${err?.message ?? err}` };
  }
}

/** One source, both sides — so you can see the spread and spot an inversion. */
export type SourcePair = {
  source: string;
  sell: RateSourceResult;
  buy: RateSourceResult;
};

/**
 * Reference rates from every source, both sides.
 *
 * These are REFERENCE ONLY. Your manual rate is what actually prices top-ups.
 * That is deliberate: an undocumented scraper should never silently decide how
 * much money a customer receives.
 */
export async function probeReferenceRates(payTypes: string[] = []): Promise<SourcePair[]> {
  const [binSell, binBuy, bybSell, bybBuy] = await Promise.all([
    fetchBinanceP2P('SELL', payTypes),
    fetchBinanceP2P('BUY', payTypes),
    fetchBybitP2P('SELL'),
    fetchBybitP2P('BUY'),
  ]);

  return [
    { source: 'binance_p2p', sell: binSell, buy: binBuy },
    { source: 'bybit_p2p', sell: bybSell, buy: bybBuy },
  ];
}

/** Back-compat for the cron: SELL side of every source. */
export async function probeAllSources(payTypes: string[] = []): Promise<{
  sell: RateSourceResult[];
  buyReference: RateSourceResult;
}> {
  const [binSell, bybSell, binBuy] = await Promise.all([
    fetchBinanceP2P('SELL', payTypes),
    fetchBybitP2P('SELL'),
    fetchBinanceP2P('BUY', payTypes),
  ]);
  return { sell: [binSell, bybSell], buyReference: binBuy };
}

/** Payment methods currently offered on the MMK book (populates the filter). */
export async function discoverPayTypes(): Promise<string[]> {
  const r = await fetchBinanceP2P('SELL', []);
  return r.payTypesSeen ?? [];
}

// ─────────────────────────────────────────────────────────────
// STORED RATES
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

/** Cron entry point. Always uses the SELL side. */
export async function refreshCryptoRate(): Promise<{
  ok: boolean;
  rate?: number;
  message: string;
  probes: RateSourceResult[];
}> {
  const settings = await getRateSettings();
  const { sell } = await probeAllSources(settings.payTypes);

  const winner = sell.find((p) => p.ok && p.rate !== null);
  const last = await getLatestStoredRate();

  if (!winner || winner.rate === null) {
    const detail = sell.map((p) => `${p.source}: ${p.detail}`).join(' | ');
    return {
      ok: false,
      message: last
        ? `All sources failed — keeping last rate ${last.usdtMmk}. ${detail}`
        : `All sources failed and NO stored rate exists. Set a manual rate in /admin/crypto-rate. ${detail}`,
      probes: sell,
    };
  }

  const fetched = winner.rate;

  if (last && last.usdtMmk > 0) {
    const deviation = Math.abs(fetched - last.usdtMmk) / last.usdtMmk;
    if (deviation > MAX_DEVIATION) {
      return {
        ok: false,
        rate: fetched,
        message: `REJECTED: ${winner.source} returned ${fetched}, ${(deviation * 100).toFixed(1)}% from last ${last.usdtMmk}. Kept old rate. If the move is real, set it manually.`,
        probes: sell,
      };
    }
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('crypto_rates')
    .insert({ usdt_mmk: fetched, source: winner.source });

  if (error) {
    return { ok: false, rate: fetched, message: `DB insert failed: ${error.message}`, probes: sell };
  }

  return {
    ok: true,
    rate: fetched,
    message: `Rate updated to ${fetched} MMK/USDT (SELL side, ${winner.source})`,
    probes: sell,
  };
}

/**
 * The rate the storefront uses, margin applied.
 * Priority: manual override > newest stored auto rate.
 */
export async function getEffectiveRate(marginPercent = 5): Promise<{
  marketRate: number;
  effectiveRate: number;
  source: string;
  isManual: boolean;
  ageMs: number;
} | null> {
  const settings = await getRateSettings();

  // MANUAL RATE IS FINAL. No margin is applied — the number you type is the
  // number customers are priced at. You have already priced your own margin in.
  if (settings.manualEnabled && settings.manualUsdtMmk && sane(settings.manualUsdtMmk)) {
    return {
      marketRate: settings.manualUsdtMmk,
      effectiveRate: Math.floor(settings.manualUsdtMmk),
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
