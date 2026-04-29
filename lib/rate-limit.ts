// lib/rate-limit.ts
import { getServiceSupabaseClient } from './supabase';

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

type RequestLogRow = {
  id: string;
  created_at: string;
};

/**
 * Simple DB-backed rate limiter.
 *
 * We avoid using `.gte(...)` in the query because of runtime issues,
 * and instead filter by date in JavaScript.
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

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowInSeconds * 1000);

  // 1) Insert a log row for this request
  const { error: insertError } = await supabase
    .from('request_logs')
    .insert({
      key,
      route,
      created_at: now.toISOString(),
    });

  if (insertError) {
    console.error('RateLimit: failed to insert log', insertError);
    // Fail-open: don't block if logging fails
    return { allowed: true };
  }

  // 2) Fetch recent logs for this key+route
  const { data, error: selectError } = await supabase
    .from('request_logs')
    .select('id, created_at')
    .eq('key', key)
    .eq('route', route)
    .order('created_at', { ascending: false })
    .limit(50); // just a recent slice

  if (selectError || !data || !Array.isArray(data)) {
    console.error('RateLimit: failed to fetch logs', selectError);
    return { allowed: true };
  }

  const rows = data as RequestLogRow[];

  // 3) Filter in JS by time window
  const recentRows = rows.filter((r) => {
    const ts = new Date(r.created_at);
    return ts.getTime() >= windowStart.getTime();
  });

  const count = recentRows.length;

  if (count <= maxRequests) {
    return { allowed: true };
  }

  // Compute retryAfterSeconds from the oldest request still in the window
  let retryAfterSeconds: number | undefined;
  try {
    // oldest within the window (smallest created_at)
    const oldest = recentRows.reduce<RequestLogRow | null>((acc, r) => {
      if (!acc) return r;
      const a = new Date(acc.created_at).getTime();
      const b = new Date(r.created_at).getTime();
      return b < a ? r : acc;
    }, null);

    if (oldest) {
      const oldestTime = new Date(oldest.created_at).getTime();
      const expiresAt = oldestTime + windowInSeconds * 1000;
      const diffMs = expiresAt - now.getTime();
      retryAfterSeconds = diffMs > 0 ? Math.ceil(diffMs / 1000) : 0;
    }
  } catch (e) {
    console.error('RateLimit: failed to compute retryAfterSeconds', e);
    retryAfterSeconds = undefined;
  }

  return {
    allowed: false,
    retryAfterSeconds,
  };
}
