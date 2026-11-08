-- One shared account (e.g. Crunchyroll, up to 5 profiles) → each customer
-- link gets its own profile name, PIN and expiry. Run once in Supabase.

alter table public.panel_links add column if not exists profile_name text;
alter table public.panel_links add column if not exists profile_pin text;
alter table public.panel_accounts add column if not exists max_profiles integer not null default 5;

-- Existing links keep showing the profile that was set on their account.
update public.panel_links l
   set profile_name = coalesce(l.profile_name, a.profile),
       profile_pin  = coalesce(l.profile_pin, a.pin)
  from public.panel_accounts a
 where a.id = l.account_id
   and (l.profile_name is null or l.profile_pin is null);
