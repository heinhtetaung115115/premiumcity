-- Manual In stock / Out of stock switch per VPN country (JP, SG, TH…).
-- A country is sold only when this switch is ON *and* it has a working
-- server that accepts new sales. Run once in the Supabase SQL editor.

create table if not exists public.vpn_country_stock (
  country text primary key,
  in_stock boolean not null default true,
  updated_at timestamptz not null default now()
);
