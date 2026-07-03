-- Atomic, race-proof rate limiting.
--
-- The previous rate limiter inserted one row per request into
-- `request_logs` and then counted matching rows in a separate query. That
-- read-then-count pattern is not atomic: concurrent requests can all read
-- the same count before any of them insert, letting a burst of requests
-- sail past the configured limit. `request_logs` also grew forever with no
-- cleanup.
--
-- This migration adds a fixed-window counter table with a unique key on
-- (key, route, window_start), so the increment is a single atomic
-- UPSERT ... ON CONFLICT statement — Postgres guarantees only one writer
-- wins the row lock per window, so the count can never be raced past the
-- limit.
--
-- Safe to run multiple times.

create table if not exists public.rate_limit_counters (
  key text not null,
  route text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, route, window_start)
);

create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (window_start);

create or replace function public.check_rate_limit(
  p_key text,
  p_route text,
  p_window_seconds integer,
  p_max_requests integer
) returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_now timestamptz := now();
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_counters (key, route, window_start, count)
  values (p_key, p_route, v_window_start, 1)
  on conflict (key, route, window_start)
  do update set count = public.rate_limit_counters.count + 1
  returning count into v_count;

  -- Opportunistic cleanup of old windows for this key/route so the table
  -- doesn't grow forever. Cheap because it's scoped to the same key/route.
  delete from public.rate_limit_counters
  where key = p_key
    and route = p_route
    and window_start < v_now - make_interval(secs => p_window_seconds * 2);

  if v_count > p_max_requests then
    return query select
      false,
      greatest(
        0,
        ceil(extract(epoch from (
          v_window_start + make_interval(secs => p_window_seconds) - v_now
        )))
      )::integer;
  else
    return query select true, null::integer;
  end if;
end;
$$;

-- Optional: once you've confirmed check_rate_limit is working (app logs no
-- longer show "RateLimit: check_rate_limit RPC unavailable"), you can drop
-- the old per-request log table:
-- drop table if exists public.request_logs;
