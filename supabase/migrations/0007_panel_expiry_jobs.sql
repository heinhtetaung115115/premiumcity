-- Expiry reminders for account-panel customers: alert admin on the expiry
-- day, repeat hourly until "Job done" is pressed. Run once in Supabase.
alter table public.panel_links add column if not exists expiry_handled_at timestamptz;
create index if not exists panel_links_expiry_idx on public.panel_links (status, warranty_until);
