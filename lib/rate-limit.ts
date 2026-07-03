// lib/rate-limit.ts
import { getServiceSupabaseClient } from './supabase';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

/**
 * DB-backed fixed-window rate limiter.
 *
 * Primary path: a single atomic Postgres RPC (`check_rate_limit`) that uses
 * an upsert against a unique (key, route, window_start) row, so concurrent
 * requests can't race past the limit the way a read-then-insert approach can.
 * See supabase/migrations/0001_atomic_rate_limit.sql for the function.
 *
 * Fallback path: if the RPC hasn't been deployed yet (fresh checkout, or the
 * migration hasn't been run), we fail back to a best-effort JS-side count so
 * the app keeps working instead of hard-failing every request.
 */
export async function checkRateLimit(opts: {
  key: string;
  route: string;
  windowInSeconds: number;
  maxRequests: number;
}): Promise<RateLimitResult> {
  const { key, route, windowInSeconds, maxRequests } = opts;

  if (!key) {
    // If no key, don't block (fail-open).
    return { allowed: true };
  }

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: key,
    p_route: route,
    p_window_seconds: windowInSeconds,
    p_max_requests: maxRequests,
  });

  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row.allowed === 'boolean') {
      return {
        allowed: row.allowed,
        retryAfterSeconds:
          row.retry_after_seconds != null ? Number(row.retry_after_seconds) : undefined,
      };
    }
  }

  if (error) {
    console.warn(
      'RateLimit: check_rate_limit RPC unavailable, falling back to legacy counter. ' +
        'Run supabase/migrations/0001_atomic_rate_limit.sql to fix this. Error:',
      error.message
    );
  }

  return legacyCheckRateLimit(opts);
}

type RequestLogRow = { id: string; created_at: string };

/**
 * Legacy fallback: not fully race-proof under heavy concurrency, but keeps
 * the app functional if the atomic RPC migration hasn't been applied yet.
 */
async function legacyCheckRateLimit(opts: {
  key: string;
  route: string;
  windowInSeconds: number;
  maxRequests: number;
}): Promise<RateLimitResult> {
  const { key, route, windowInSeconds, maxRequests } = opts;
  const supabase = getServiceSupabaseClient();

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowInSeconds * 1000);

  const { data, error: selectError } = await supabase
    .from('request_logs')
    .select('id, created_at')
    .eq('key', key)
    .eq('route', route)
    .order('created_at', { ascending: false })
    .limit(200);

  if (selectError || !data || !Array.isArray(data)) {
    console.error('RateLimit: failed to fetch logs', selectError);
    return { allowed: true };
  }

  const rows = data as RequestLogRow[];
  const recentRows = rows.filter((r) => new Date(r.created_at).getTime() >= windowStart.getTime());
  const count = recentRows.length;

  if (count >= maxRequests) {
    let retryAfterSeconds: number | undefined;
    try {
      const oldest = recentRows.reduce<RequestLogRow | null>((acc, r) => {
        if (!acc) return r;
        return new Date(r.created_at).getTime() < new Date(acc.created_at).getTime() ? r : acc;
      }, null);
      if (oldest) {
        const expiresAt = new Date(oldest.created_at).getTime() + windowInSeconds * 1000;
        retryAfterSeconds = Math.max(0, Math.ceil((expiresAt - now.getTime()) / 1000));
      }
    } catch {
      retryAfterSeconds = undefined;
    }
    return { allowed: false, retryAfterSeconds };
  }

  const { error: insertError } = await supabase.from('request_logs').insert({
    key,
    route,
    created_at: now.toISOString(),
  });

  if (insertError) {
    console.error('RateLimit: failed to insert log', insertError);
  }

  return { allowed: true };
}
