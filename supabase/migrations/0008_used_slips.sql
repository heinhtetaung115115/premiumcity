-- Slips paid outside the website (Viber / Telegram customers).
-- Any transaction number listed here can never be used for a website top-up.
create table if not exists public.used_slips (
  id uuid primary key default gen_random_uuid(),
  transaction_id text not null,
  tid_digits text not null unique,      -- digits only, used for matching
  amount numeric,
  sender_name text,
  slip_time text,
  note text,
  read_by text not null default 'manual', -- 'qr' | 'ai' | 'manual'
  created_at timestamptz not null default now()
);

alter table public.used_slips enable row level security;
-- No policies: only the server (service role) can read or write it.
