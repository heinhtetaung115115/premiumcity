-- Account panel (pcity.online): shared accounts, customer warranty links,
-- and forwarded emails (login codes). Run once in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.panel_accounts (
  id uuid primary key default gen_random_uuid(),
  service text not null default 'crunchyroll',
  email text not null,
  password text not null default '',
  profile text,
  pin text,
  account_expires_at timestamptz,
  supplier text,
  notes text,
  status text not null default 'active',          -- 'active' | 'archived'
  password_updated_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists panel_accounts_email_idx on public.panel_accounts (lower(email));

create table if not exists public.panel_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  account_id uuid not null references public.panel_accounts(id) on delete cascade,
  customer_name text,
  customer_email text,
  warranty_until timestamptz not null,
  status text not null default 'active',          -- 'active' | 'revoked'
  source text not null default 'manual',          -- 'manual' | 'premiumcity'
  last_viewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists panel_links_account_idx on public.panel_links (account_id);

-- Emails forwarded into codes@pcity.online (via Cloudflare Email Routing).
create table if not exists public.panel_emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.panel_accounts(id) on delete set null,
  to_addresses text,                               -- every address we saw (to/delivered-to/…)
  from_address text,
  subject text,
  text_body text,
  html_body text,
  verdict text not null default 'blocked',         -- 'allowed' | 'blocked'
  reason text,
  code text,
  action_link text,
  received_at timestamptz not null default now()
);
create index if not exists panel_emails_account_idx on public.panel_emails (account_id, received_at desc);
create index if not exists panel_emails_received_idx on public.panel_emails (received_at desc);
