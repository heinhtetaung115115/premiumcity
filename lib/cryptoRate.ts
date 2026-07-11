// lib/cryptoRate.ts
//
// MMK-per-USDT rate engine.
//
// Design notes (this is money — read before changing):
//  - We NEVER price a top-up off a live fetch at request time. The rate is
//    refreshed by cron into `crypto_rates`, and reads come from the DB.
//  - We take the MEDIAN of several ads, not the single best price. The best
//    ad is the easiest to manipulate and is often a bait listing.
//  - We CLAMP: if a new rate deviates too far from the last good one, we
//    reject it and keep the previous value. A bad rate = crediting someone
//    10x too much MMK.
//  - Admin can force a manual rate, which always wins.
//
// Env:
//   CRYPTO_MARGIN_PERCENT   - your spread, e.g. "4" = credit 4% less MMK (default 4)
//   CRYPTO_RATE_FALLBACK    - hardcoded MMK/USDT used only if DB + fetch both fail

import { getServiceSupabaseClient } from '@/lib/supabase';

const BINANCE_P2P_URL =
  'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

/** Max % a new rate may deviate from the last known good rate before we reject it. */
const MAX_DEVIATION_PERCENT = 12;

export type RateInfo = {
  /** Raw market rate: MMK per 1 USDT. */
  marketRate: number;
  /** Rate actually used to credit the user (market minus your margin). */
  effectiveRate: number;
  marginPercent: number;
  source: string;
  fetchedAt: string | null;
  stale: boolean;
};

function marginPercent(): number {
  const v = Number(process.env.CRYPTO_MARGIN_PERCENT);
  return Number.isFinite(v) && v >= 0 && v < 50 ? v : 4;
}

function median(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid];
}

/**
 * Fetch USDT/MMK ads from Binance P2P.
 *
 * IMPORTANT: this is Binance's *internal* frontend endpoint, not a documented
 * public API. It can change or break without notice, and Binance often blocks
 * datacenter IPs — so this may simply fail from Vercel. Every caller must
 * handle null. That is by design, not an oversight.
 *
 * tradeType 'BUY' = ads where merchants SELL you USDT (you'd pay this to buy).
 * tradeType 'SELL' = ads where merchants BUY USDT from you (what you'd get
 * when selling). Since a customer sends us USDT and we credit MMK, we are
 * effectively going to sell that USDT for MMK — so we quote off the SELL side,
 * which is the conservative direction for us.
 */
export async function fetchBinanceP2PRate(): Promise<number | null> {
  try {
    const res = await fetch(BINANCE_P2P_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Binance rejects requests that don't look like the web app.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Origin: 'https://p2p.binance.com',
        Referer: 'https://p2p.binance.com/',
      },
      body: JSON.stringify({
        asset: 'USDT',
        fiat: 'MMK',
        tradeType: 'SELL',
        page: 1,
        rows: 20,
        payTypes: [],
        publisherType: null,
      }),
      cache: 'no-store',
      // Don't let a hanging request stall a cron run.
      signal: AbortSignal.timeout(12_000),
    });

    if (!res.ok) {
      console.error('[cryptoRate] Binance P2P HTTP', res.status);
      return null;
    }

    const json: any = await res.json();
    const ads: any[] = json?.data ?? [];
    if (!Array.isArray(ads) || ads.length === 0) {
      console.error('[cryptoRate] Binance P2P returned no ads');
      return null;
    }

    // Filter out junk/outlier ads before taking the median.
    const prices = ads
      .map((a) => ({
        price: Number(a?.adv?.price),
        finishRate: Number(a?.advertiser?.monthFinishRate ?? 0),
        minAmt: Number(a?.adv?.minSingleTransAmount ?? 0),
      }))
      // merchants who actually complete trades
      .filter((a) => a.finishRate >= 0.8 || a.finishRate === 0)
      .map((a) => a.price)
      .filter((p) => Number.isFinite(p) && p > 0);

    // Use the top ~10 (best-priced) ads, then median them.
    const top = prices.slice(0, 10);
    const m = median(top);

    if (!m) {
      console.error('[cryptoRate] Binance P2P: no usable prices');
      return null;
    }
    return m;
  } catch (err) {
    console.error('[cryptoRate] Binance P2P fetch failed:', err);
    return null;
  }
}

/** The most recent stored rate (any source). */
export async function getLatestStoredRate(): Promise<{
  rate: number;
  source: string;
  fetchedAt: string;
} | null> {
  try {
    const supabase = getServiceSupabaseClient();
    const { data } = await supabase
      .from('crypto_rates')
      .select('mmk_per_usdt,source,fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(1);

    const row = (data ?? [])[0] as any;
    if (!row) return null;
    const rate = Number(row.mmk_per_usdt);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    return { rate, source: String(row.source), fetchedAt: String(row.fetched_at) };
  } catch (err) {
    console.error('[cryptoRate] getLatestStoredRate failed:', err);
    return null;
  }
}

/**
 * Refresh the rate (called by cron). Returns what was stored, or null if we
 * declined to store anything.
 *
 * Clamping: a wild swing almost always means a broken/manipulated feed, not a
 * real market move. We'd rather serve a slightly stale rate than a wrong one.
 */
export async function refreshRate(): Promise<{
  stored: boolean;
  rate: number | null;
  reason: string;
}> {
  const fetched = await fetchBinanceP2PRate();

  if (fetched === null) {
    return { stored: false, rate: null, reason: 'fetch_failed' };
  }

  const last = await getLatestStoredRate();

  if (last) {
    const deviation = Math.abs((fetched - last.rate) / last.rate) * 100;
    if (deviation > MAX_DEVIATION_PERCENT) {
      console.error(
        `[cryptoRate] REJECTED rate ${fetched} — deviates ${deviation.toFixed(1)}% from last good ${last.rate}`
      );
      return { stored: false, rate: fetched, reason: 'deviation_too_large' };
    }
  }

  try {
    const supabase = getServiceSupabaseClient();
    const { error } = await supabase.from('crypto_rates').insert({
      source: 'binance_p2p',
      mmk_per_usdt: fetched,
    });
    if (error) throw error;
    return { stored: true, rate: fetched, reason: 'ok' };
  } catch (err) {
    console.error('[cryptoRate] failed to store rate:', err);
    return { stored: false, rate: fetched, reason: 'store_failed' };
  }
}

/** Admin: force a manual rate (always becomes the newest row, so it wins). */
export async function setManualRate(rate: number): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('crypto_rates').insert({
    source: 'manual',
    mmk_per_usdt: rate,
  });
  if (error) throw error;
}

/**
 * The rate to show/use right now. Falls back gracefully:
 *   stored rate -> env fallback -> throw
 */
export async function getRateInfo(): Promise<RateInfo> {
  const mp = marginPercent();
  const stored = await getLatestStoredRate();

  if (stored) {
    const ageMs = Date.now() - new Date(stored.fetchedAt).getTime();
    const stale = ageMs > 2 * 60 * 60 * 1000; // older than 2h
    return {
      marketRate: stored.rate,
      effectiveRate: Math.floor(stored.rate * (1 - mp / 100)),
      marginPercent: mp,
      source: stored.source,
      fetchedAt: stored.fetchedAt,
      stale,
    };
  }

  const fallback = Number(process.env.CRYPTO_RATE_FALLBACK);
  if (Number.isFinite(fallback) && fallback > 0) {
    return {
      marketRate: fallback,
      effectiveRate: Math.floor(fallback * (1 - mp / 100)),
      marginPercent: mp,
      source: 'env_fallback',
      fetchedAt: null,
      stale: true,
    };
  }

  throw new Error(
    'No MMK/USDT rate available. Set a manual rate in admin or configure CRYPTO_RATE_FALLBACK.'
  );
}
