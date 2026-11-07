-- VPN plans ("subscriptions") with replaceable server keys.
--
-- A vpn_subscription is what the customer bought: data allowance per 30-day
-- period, start/end dates and a private link code (/vpn/<code>). The actual
-- Outline access key lives in vpn_keys and can be swapped at any time
-- (customer "request new key", admin moving everyone to next month's server,
-- or the automatic 30-day data reset) without touching the expiry date.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

create extension if not exists pgcrypto;

-- ── Servers: extra fields ─────────────────────────────────────────────
alter table public.vpn_servers add column if not exists name text;
alter table public.vpn_servers add column if not exists paid_until date;
alter table public.vpn_servers add column if not exists accepting_new boolean not null default true;
alter table public.vpn_servers add column if not exists last_usage_sync_at timestamptz;
alter table public.vpn_servers add column if not exists created_at timestamptz not null default now();

-- ── Subscriptions ─────────────────────────────────────────────────────
create table if not exists public.vpn_subscriptions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- private link code
  user_id uuid references public.users(id) on delete set null,
  order_id uuid,
  order_item_id uuid,
  source text not null default 'website',          -- 'website' | 'manual'
  customer_note text,                              -- e.g. "Ko Aung (Viber)"
  plan_name text,
  country text,
  vpn_plan_id uuid,
  data_limit_bytes bigint not null,                -- allowance per period
  period_days integer not null default 30,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  period_started_at timestamptz not null default now(),
  period_used_prior_bytes bigint not null default 0, -- usage from keys retired this period
  status text not null default 'active',           -- 'active' | 'expired' | 'revoked'
  locked_until timestamptz,                        -- short lock while swapping keys
  created_at timestamptz not null default now()
);

create index if not exists vpn_subscriptions_user_idx on public.vpn_subscriptions(user_id);
create index if not exists vpn_subscriptions_status_idx on public.vpn_subscriptions(status, expires_at);
create index if not exists vpn_subscriptions_item_idx on public.vpn_subscriptions(order_item_id);

-- ── Keys: link to subscription + history ──────────────────────────────
alter table public.vpn_keys add column if not exists created_at timestamptz not null default now();
alter table public.vpn_keys add column if not exists used_bytes bigint default 0;
alter table public.vpn_keys add column if not exists subscription_id uuid references public.vpn_subscriptions(id) on delete cascade;
alter table public.vpn_keys add column if not exists is_current boolean not null default true;
alter table public.vpn_keys add column if not exists retired_at timestamptz;
alter table public.vpn_keys add column if not exists retire_reason text;
alter table public.vpn_keys alter column user_id drop not null;
alter table public.vpn_keys alter column order_id drop not null;
alter table public.vpn_keys alter column order_item_id drop not null;
alter table public.vpn_keys alter column vpn_plan_id drop not null;

create index if not exists vpn_keys_subscription_idx on public.vpn_keys(subscription_id, is_current);
create index if not exists vpn_keys_server_idx on public.vpn_keys(vpn_server_id, is_current);

-- ── Replacement log (customer limit: 3 per 30 days) ───────────────────
create table if not exists public.vpn_key_replacements (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.vpn_subscriptions(id) on delete cascade,
  reason text not null,          -- 'customer_request' | 'server_move' | 'admin' | 'new_period'
  from_server_id uuid,
  to_server_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists vpn_key_replacements_sub_idx
  on public.vpn_key_replacements(subscription_id, reason, created_at desc);

-- ── Atomic helpers ────────────────────────────────────────────────────

-- Take a 90-second lock on a subscription so two key swaps can't run at once.
create or replace function public.vpn_try_lock(p_subscription_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_ok boolean;
begin
  update public.vpn_subscriptions
     set locked_until = now() + interval '90 seconds'
   where id = p_subscription_id
     and (locked_until is null or locked_until < now())
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

create or replace function public.vpn_unlock(p_subscription_id uuid)
returns void
language sql
as $$
  update public.vpn_subscriptions set locked_until = null where id = p_subscription_id;
$$;

-- Claim one customer replacement if fewer than p_max in the last p_days.
-- Row lock on the subscription makes concurrent taps count correctly.
create or replace function public.vpn_claim_replacement(
  p_subscription_id uuid,
  p_max integer,
  p_days integer
) returns boolean
language plpgsql
as $$
declare
  v_count integer;
begin
  perform 1 from public.vpn_subscriptions where id = p_subscription_id for update;
  select count(*) into v_count
    from public.vpn_key_replacements
   where subscription_id = p_subscription_id
     and reason = 'customer_request'
     and created_at > now() - make_interval(days => p_days);
  if v_count >= p_max then
    return false;
  end if;
  insert into public.vpn_key_replacements (subscription_id, reason)
  values (p_subscription_id, 'customer_request');
  return true;
end;
$$;

-- ── Migrate existing keys: one subscription per old key ───────────────
do $$
declare
  k record;
  v_sub uuid;
  v_start timestamptz;
  v_period_start timestamptz;
begin
  for k in
    select * from public.vpn_keys where subscription_id is null
  loop
    v_start := coalesce(k.created_at, now());
    -- Current 30-day period inside the plan
    v_period_start := v_start + make_interval(
      days => (floor(greatest(extract(epoch from (now() - v_start)), 0) / 86400 / 30) * 30)::int
    );

    insert into public.vpn_subscriptions (
      code, user_id, order_id, order_item_id, source, plan_name, country,
      vpn_plan_id, data_limit_bytes, starts_at, expires_at, period_started_at,
      status
    ) values (
      replace(replace(replace(encode(gen_random_bytes(9), 'base64'), '+', 'x'), '/', 'y'), '=', ''),
      k.user_id, k.order_id, k.order_item_id, 'website', k.plan_name, k.country,
      k.vpn_plan_id,
      coalesce(k.data_limit_bytes, 0),
      v_start,
      coalesce(k.expires_at, v_start + interval '30 days'),
      v_period_start,
      case when coalesce(k.expires_at, v_start + interval '30 days') < now()
           then 'expired' else 'active' end
    )
    returning id into v_sub;

    update public.vpn_keys
       set subscription_id = v_sub, is_current = true
     where id = k.id;
  end loop;
end;
$$;
