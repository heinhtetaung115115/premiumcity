-- VPN server health checks, backup servers and queued "move all" jobs.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table public.vpn_servers add column if not exists is_backup boolean not null default false;
alter table public.vpn_servers add column if not exists health_fail_count integer not null default 0;
alter table public.vpn_servers add column if not exists last_health_at timestamptz;
alter table public.vpn_servers add column if not exists down_alerted_at timestamptz;     -- set while an outage alert is open
alter table public.vpn_servers add column if not exists blocked_alerted_at timestamptz;  -- last "maybe blocked" alert
alter table public.vpn_servers add column if not exists pending_move_to uuid;            -- queued Move all → this server

create index if not exists vpn_key_replacements_from_idx
  on public.vpn_key_replacements(from_server_id, reason, created_at desc);
