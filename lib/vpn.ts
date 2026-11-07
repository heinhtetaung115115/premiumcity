// lib/vpn.ts
// Outline VPN plans ("subscriptions") with replaceable keys.
//
// Model:
//  - vpn_subscriptions = what the customer bought (data per 30-day period,
//    start/end dates, private link code). Never changes when servers change.
//  - vpn_keys = the actual Outline key. Exactly one `is_current` key per
//    active subscription; older keys are kept as history (is_current=false).
//
// Customers get a *dynamic* key (ssconf://…/api/vpn/conf/<code>). The Outline
// app fetches the current server/password from us on every connect, so when
// we swap a key (customer request, monthly server move, 30-day data reset)
// the customer's app just keeps working.

import crypto from 'crypto';
import { getServiceSupabaseClient } from './supabase';
import {
  outlineCreateKey,
  outlineDeleteKey,
  outlineGetTransfer,
  outlinePing,
  parseSsUri,
  type SsConfig,
} from './outline';
import { sendTelegramMessage } from './telegram';

export const CUSTOMER_REPLACE_MAX = 3;
export const CUSTOMER_REPLACE_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Types ──────────────────────────────────────────────

export type VpnServer = {
  id: string;
  name: string | null;
  country: string | null;
  api_url: string;
  is_active: boolean | null;
  accepting_new: boolean | null;
  paid_until: string | null;
  last_usage_sync_at: string | null;
  created_at: string | null;
  is_backup: boolean | null;
  health_fail_count: number | null;
  last_health_at: string | null;
  down_alerted_at: string | null;
  blocked_alerted_at: string | null;
  pending_move_to: string | null;
};

export type VpnSubscription = {
  id: string;
  code: string;
  user_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  source: string;
  customer_note: string | null;
  plan_name: string | null;
  country: string | null;
  vpn_plan_id: string | null;
  data_limit_bytes: number;
  period_days: number;
  starts_at: string;
  expires_at: string;
  period_started_at: string;
  period_used_prior_bytes: number;
  status: string;
  created_at: string;
};

export type VpnKeyRow = {
  id: string;
  subscription_id: string | null;
  vpn_server_id: string | null;
  outline_key_id: string | null;
  ss_uri: string | null;
  used_bytes: number | null;
  is_current: boolean | null;
  created_at: string | null;
  user_id: string | null;
  order_id: string | null;
  order_item_id: string | null;
  vpn_plan_id: string | null;
  country: string | null;
  plan_name: string | null;
};

const SUB_COLS =
  'id,code,user_id,order_id,order_item_id,source,customer_note,plan_name,country,vpn_plan_id,data_limit_bytes,period_days,starts_at,expires_at,period_started_at,period_used_prior_bytes,status,created_at';
const KEY_COLS =
  'id,subscription_id,vpn_server_id,outline_key_id,ss_uri,used_bytes,is_current,created_at,user_id,order_id,order_item_id,vpn_plan_id,country,plan_name';
const SERVER_COLS =
  'id,name,country,api_url,is_active,accepting_new,paid_until,last_usage_sync_at,created_at,is_backup,health_fail_count,last_health_at,down_alerted_at,blocked_alerted_at,pending_move_to';

// ─── Small helpers ──────────────────────────────────────

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'https://pcitystore.com').replace(
    /\/+$/,
    ''
  );
}

export function statusPageUrl(code: string): string {
  return `${siteUrl()}/vpn/${code}`;
}

/** The permanent key customers add to Outline. */
export function dynamicKeyFor(code: string): string {
  const host = siteUrl().replace(/^https?:\/\//, '');
  return `ssconf://${host}/api/vpn/conf/${code}#PremiumCity`;
}

/** Subscription link for Hiddify / V2Box / v2rayNG etc. (base64 list of ss:// keys). */
export function subscriptionLinkFor(code: string): string {
  return `${siteUrl()}/api/vpn/sub/${code}`;
}

export function newCode(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v) || 0);

function expiryLabel(iso: string): string {
  const d = new Date(iso);
  const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()];
  return `${m}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function withTag(ssUri: string, tag: string): string {
  return ssUri.includes('#') ? ssUri : `${ssUri}#${encodeURIComponent(tag)}`;
}

function periodEnd(sub: Pick<VpnSubscription, 'period_started_at' | 'period_days'>): Date {
  return new Date(new Date(sub.period_started_at).getTime() + (sub.period_days || 30) * DAY_MS);
}

export function isExpired(sub: Pick<VpnSubscription, 'expires_at' | 'status'>): boolean {
  return sub.status !== 'active' || new Date(sub.expires_at).getTime() <= Date.now();
}

/** Data used in the current 30-day period. */
export function periodUsedBytes(sub: VpnSubscription, key: VpnKeyRow | null): number {
  return num(sub.period_used_prior_bytes) + num(key?.used_bytes);
}

/**
 * Server is "under maintenance" for customers while we know it has a problem:
 * a move is queued/running, it's down (alert open), or several customers
 * reported a bad line in the last 3 hours. During this time customers see an
 * "updating our server" screen instead of burning key replacements.
 */
export function isServerInMaintenance(s: Partial<VpnServer> | null | undefined): boolean {
  if (!s) return false;
  if (s.pending_move_to) return true;
  if (s.down_alerted_at) return true;
  if (s.blocked_alerted_at && Date.now() - new Date(s.blocked_alerted_at).getTime() < 3 * 60 * 60 * 1000) {
    return true;
  }
  return false;
}

// ─── Loaders ────────────────────────────────────────────

export async function listServers(): Promise<VpnServer[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('vpn_servers').select(SERVER_COLS).order('created_at', {
    ascending: false,
  });
  if (error) throw error;
  return (data ?? []) as VpnServer[];
}

async function getServer(id: string | null | undefined): Promise<VpnServer | null> {
  if (!id) return null;
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase.from('vpn_servers').select(SERVER_COLS).eq('id', id).maybeSingle();
  return (data as VpnServer) ?? null;
}

export async function getSubscriptionByCode(code: string): Promise<VpnSubscription | null> {
  if (!code || !/^[A-Za-z0-9_-]{6,40}$/.test(code)) return null;
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase.from('vpn_subscriptions').select(SUB_COLS).eq('code', code).maybeSingle();
  return (data as VpnSubscription) ?? null;
}

export async function getSubscriptionById(id: string): Promise<VpnSubscription | null> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase.from('vpn_subscriptions').select(SUB_COLS).eq('id', id).maybeSingle();
  return (data as VpnSubscription) ?? null;
}

export async function getCurrentKey(subscriptionId: string): Promise<VpnKeyRow | null> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('vpn_keys')
    .select(KEY_COLS)
    .eq('subscription_id', subscriptionId)
    .eq('is_current', true)
    .order('created_at', { ascending: false })
    .limit(1);
  return ((data ?? []) as VpnKeyRow[])[0] ?? null;
}

/**
 * Server for new keys: active + accepting new customers in that country,
 * newest paid server first (so new sales land on next month's server).
 */
export async function pickServer(country: string | null, excludeId?: string | null): Promise<VpnServer | null> {
  const servers = await listServers();
  const c = (country || '').toUpperCase();
  const candidates = servers.filter(
    (s) =>
      s.is_active !== false &&
      s.accepting_new !== false &&
      s.is_backup !== true &&
      s.id !== excludeId &&
      (!c || String(s.country || '').toUpperCase() === c)
  );
  candidates.sort((a, b) => {
    const pa = a.paid_until ? new Date(a.paid_until).getTime() : 0;
    const pb = b.paid_until ? new Date(b.paid_until).getTime() : 0;
    if (pb !== pa) return pb - pa;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
  return candidates[0] ?? null;
}

// ─── Create ─────────────────────────────────────────────

export type CreateSubscriptionInput = {
  userId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  source: 'website' | 'manual';
  customerNote?: string | null;
  planName?: string | null;
  country?: string | null;
  vpnPlanId?: string | null;
  dataLimitBytes: number; // per 30-day period; <= 0 = unlimited
  durationDays: number;
  serverId?: string | null;
};

export async function createSubscription(input: CreateSubscriptionInput): Promise<VpnSubscription> {
  const supabase = getServiceSupabaseClient();
  const server = input.serverId ? await getServer(input.serverId) : await pickServer(input.country ?? null);
  if (!server || server.is_active === false) {
    throw new Error(`VPN_SERVER_NOT_FOUND: No active VPN server available${input.country ? ` for ${input.country}` : ''}`);
  }

  const code = newCode();
  const now = new Date();
  const days = Math.max(1, Math.round(input.durationDays || 30));
  const expiresAt = new Date(now.getTime() + days * DAY_MS).toISOString();
  const limit = Number(input.dataLimitBytes) || 0;
  const country = (input.country || server.country || '').toUpperCase() || null;

  const key = await outlineCreateKey(server.api_url, {
    name: `${code} ${input.customerNote || ''}`.trim().slice(0, 50),
    limitBytes: limit > 0 ? limit : null,
  }).catch((e) => {
    throw new Error(`VPN_PROVISIONING_FAILED: ${e?.message ?? e}`);
  });

  const { data: subRow, error: subErr } = await supabase
    .from('vpn_subscriptions')
    .insert({
      code,
      user_id: input.userId ?? null,
      order_id: input.orderId ?? null,
      order_item_id: input.orderItemId ?? null,
      source: input.source,
      customer_note: input.customerNote ?? null,
      plan_name: input.planName ?? null,
      country,
      vpn_plan_id: input.vpnPlanId ?? null,
      data_limit_bytes: limit,
      period_days: 30,
      starts_at: now.toISOString(),
      expires_at: expiresAt,
      period_started_at: now.toISOString(),
      status: 'active',
    })
    .select(SUB_COLS)
    .single();

  if (subErr || !subRow) {
    await outlineDeleteKey(server.api_url, key.id);
    throw new Error(`VPN_PROVISIONING_FAILED: could not save plan (${subErr?.message ?? 'unknown'})`);
  }
  const sub = subRow as VpnSubscription;

  const { error: keyErr } = await supabase.from('vpn_keys').insert({
    subscription_id: sub.id,
    user_id: input.userId ?? null,
    order_id: input.orderId ?? null,
    order_item_id: input.orderItemId ?? null,
    vpn_server_id: server.id,
    vpn_plan_id: input.vpnPlanId ?? null,
    outline_key_id: key.id,
    ss_uri: withTag(key.accessUrl, `PC-${expiryLabel(expiresAt)}`),
    country,
    plan_name: input.planName ?? null,
    data_limit_bytes: limit,
    expires_at: expiresAt,
    used_bytes: 0,
    is_current: true,
  });

  if (keyErr) {
    await outlineDeleteKey(server.api_url, key.id);
    await supabase.from('vpn_subscriptions').delete().eq('id', sub.id);
    throw new Error(`VPN_PROVISIONING_FAILED: could not save key (${keyErr.message})`);
  }

  return sub;
}

// ─── Swap a key ─────────────────────────────────────────

type RotateOptions = {
  reason: 'customer_request' | 'server_move' | 'admin' | 'new_period' | 'reactivate';
  /** Server for the new key. Default: same server if still active, else best available. */
  targetServerId?: string | null;
  /** Start a fresh 30-day data period at this time (full allowance). */
  newPeriodStart?: string | null;
  /** Usage already fetched from the old server (keyed by Outline key id). */
  knownUsage?: Record<string, number> | null;
  /** Old server is unreachable: don't wait on it. */
  oldServerDead?: boolean;
  /** Only swap if the current key is still on this server (makes moves safe to repeat). */
  onlyIfOnServerId?: string | null;
};

export async function rotateKey(
  subscriptionId: string,
  opts: RotateOptions
): Promise<{
  ok: boolean;
  serverName?: string | null;
  fromServerId?: string | null;
  error?: string;
  busy?: boolean;
  skipped?: boolean;
}> {
  const supabase = getServiceSupabaseClient();

  const { data: locked } = await supabase.rpc('vpn_try_lock', { p_subscription_id: subscriptionId });
  if (locked !== true) {
    return { ok: false, busy: true, error: 'This key is being updated right now. Try again in a minute.' };
  }

  try {
    const sub = await getSubscriptionById(subscriptionId);
    if (!sub) return { ok: false, error: 'Plan not found.' };

    const oldKey = await getCurrentKey(sub.id);
    const oldServer = oldKey ? await getServer(oldKey.vpn_server_id) : null;

    if (opts.onlyIfOnServerId && oldKey?.vpn_server_id !== opts.onlyIfOnServerId) {
      return { ok: true, skipped: true, serverName: null }; // already moved
    }

    let target: VpnServer | null = null;
    if (opts.targetServerId) target = await getServer(opts.targetServerId);
    else if (oldServer && oldServer.is_active !== false) target = oldServer;
    else target = await pickServer(sub.country);
    if (!target || target.is_active === false) return { ok: false, error: 'No active server to move to.' };

    // Latest usage of the old key (best effort; falls back to last synced value)
    let oldUsed = num(oldKey?.used_bytes);
    if (oldKey?.outline_key_id) {
      let live: number | undefined = opts.knownUsage?.[oldKey.outline_key_id];
      if (live === undefined && oldServer && !opts.oldServerDead && !opts.knownUsage) {
        try {
          live = (await outlineGetTransfer(oldServer.api_url, 5000))[oldKey.outline_key_id];
        } catch {
          /* server down: keep stored value */
        }
      }
      if (live !== undefined) oldUsed = Math.max(oldUsed, num(live));
    }

    const freshPeriod = !!opts.newPeriodStart;
    const newPrior = freshPeriod ? 0 : num(sub.period_used_prior_bytes) + oldUsed;
    const limit = num(sub.data_limit_bytes);
    const keyLimit = limit > 0 ? Math.max(0, limit - newPrior) : null;

    let created;
    try {
      created = await outlineCreateKey(target.api_url, {
        name: `${sub.code} ${sub.customer_note || ''}`.trim().slice(0, 50),
        limitBytes: keyLimit,
      });
    } catch (e: any) {
      return { ok: false, error: `Could not create key on ${target.name || 'server'}: ${e?.message ?? e}` };
    }

    const { error: insErr } = await supabase.from('vpn_keys').insert({
      subscription_id: sub.id,
      user_id: sub.user_id,
      order_id: sub.order_id,
      order_item_id: sub.order_item_id,
      vpn_server_id: target.id,
      vpn_plan_id: sub.vpn_plan_id,
      outline_key_id: created.id,
      ss_uri: withTag(created.accessUrl, `PC-${expiryLabel(sub.expires_at)}`),
      country: sub.country,
      plan_name: sub.plan_name,
      data_limit_bytes: limit,
      expires_at: sub.expires_at,
      used_bytes: 0,
      is_current: true,
    });
    if (insErr) {
      await outlineDeleteKey(target.api_url, created.id);
      return { ok: false, error: `Could not save new key: ${insErr.message}` };
    }

    if (oldKey) {
      await supabase
        .from('vpn_keys')
        .update({
          is_current: false,
          retired_at: new Date().toISOString(),
          retire_reason: opts.reason,
          used_bytes: oldUsed,
        })
        .eq('id', oldKey.id);
    }

    await supabase
      .from('vpn_subscriptions')
      .update({
        period_used_prior_bytes: newPrior,
        ...(freshPeriod ? { period_started_at: opts.newPeriodStart } : {}),
        ...(opts.reason === 'reactivate' ? { status: 'active' } : {}),
      })
      .eq('id', sub.id);

    // customer_request rows are written by vpn_claim_replacement already —
    // just record which server the complaint was about.
    if (opts.reason === 'customer_request') {
      const { data: claimRows } = await supabase
        .from('vpn_key_replacements')
        .select('id')
        .eq('subscription_id', sub.id)
        .eq('reason', 'customer_request')
        .is('from_server_id', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const claimId = ((claimRows ?? []) as any[])[0]?.id;
      if (claimId) {
        await supabase
          .from('vpn_key_replacements')
          .update({ from_server_id: oldServer?.id ?? null, to_server_id: target.id })
          .eq('id', claimId);
      }
    } else {
      await supabase.from('vpn_key_replacements').insert({
        subscription_id: sub.id,
        reason: opts.reason,
        from_server_id: oldServer?.id ?? null,
        to_server_id: target.id,
      });
    }

    // Remove the old key from its server last (best effort)
    if (oldKey?.outline_key_id && oldServer && !opts.oldServerDead) {
      await outlineDeleteKey(oldServer.api_url, oldKey.outline_key_id);
    }

    return { ok: true, serverName: target.name, fromServerId: oldServer?.id ?? null };
  } finally {
    await supabase.rpc('vpn_unlock', { p_subscription_id: subscriptionId });
  }
}

// ─── Customer: request a new key ────────────────────────

export async function replacementsLeft(subscriptionId: string): Promise<number> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('vpn_key_replacements')
    .select('created_at')
    .eq('subscription_id', subscriptionId)
    .eq('reason', 'customer_request')
    .order('created_at', { ascending: false })
    .limit(50);
  const since = Date.now() - CUSTOMER_REPLACE_WINDOW_DAYS * DAY_MS;
  const used = ((data ?? []) as any[]).filter((r) => new Date(r.created_at).getTime() > since).length;
  return Math.max(0, CUSTOMER_REPLACE_MAX - used);
}

export async function customerRequestNewKey(
  code: string
): Promise<{ ok: boolean; left?: number; error?: string }> {
  const supabase = getServiceSupabaseClient();
  const sub = await getSubscriptionByCode(code);
  if (!sub || isExpired(sub)) return { ok: false, error: 'This VPN plan has expired.' };

  // Known server problem: don't make a pointless key on the same server and
  // don't use up one of the customer's 3 monthly replacements.
  const currentKey = await getCurrentKey(sub.id);
  if (currentKey && isServerInMaintenance(await getServer(currentKey.vpn_server_id))) {
    return { ok: false, error: 'maintenance' };
  }

  const { data: claimed, error: claimErr } = await supabase.rpc('vpn_claim_replacement', {
    p_subscription_id: sub.id,
    p_max: CUSTOMER_REPLACE_MAX,
    p_days: CUSTOMER_REPLACE_WINDOW_DAYS,
  });
  if (claimErr) return { ok: false, error: 'Please try again in a moment.' };
  if (claimed !== true) {
    return { ok: false, error: 'limit', left: 0 };
  }

  const res = await rotateKey(sub.id, { reason: 'customer_request' });
  if (!res.ok) {
    // Give the slot back — the swap didn't happen.
    const { data: last } = await supabase
      .from('vpn_key_replacements')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('reason', 'customer_request')
      .order('created_at', { ascending: false })
      .limit(1);
    const lastId = ((last ?? []) as any[])[0]?.id;
    if (lastId) await supabase.from('vpn_key_replacements').delete().eq('id', lastId);
    return { ok: false, error: 'Could not create a new key right now. Please contact us.' };
  }

  const left = await replacementsLeft(sub.id);
  if (res.fromServerId) {
    await checkMaybeBlocked(res.fromServerId).catch(() => {});
  }

  // Tell admin: several complaints about the same server = it may be blocked.
  try {
    let email = '';
    if (sub.user_id) {
      const { data: u } = await supabase.from('users').select('email').eq('id', sub.user_id).maybeSingle();
      email = (u as any)?.email ?? '';
    }
    const who = [email, sub.customer_note].filter(Boolean).join(' · ') || sub.code;
    await sendTelegramMessage({
      text: [
        '🔁 <b>VPN key replaced by customer</b>',
        '',
        `👤 ${escapeHtml(who)}`,
        `🖥 Server: <b>${escapeHtml(res.serverName || '—')}</b>`,
        `📦 ${escapeHtml(sub.plan_name || 'VPN')} · ${CUSTOMER_REPLACE_MAX - left}/${CUSTOMER_REPLACE_MAX} used this month`,
        '',
        'Customer says the line is bad. If several customers report the same server, it may be blocked.',
      ].join('\n'),
      buttons: [[{ text: '🔗 VPN admin', url: `${siteUrl()}/admin/vpn` }]],
    });
  } catch {
    /* alert is best effort */
  }

  return { ok: true, left };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Usage sync ─────────────────────────────────────────

/** Pull usage for every current key on one server. Returns false if the server didn't answer. */
export async function syncServerUsage(server: VpnServer): Promise<boolean> {
  const supabase = getServiceSupabaseClient();
  let usage: Record<string, number>;
  try {
    usage = await outlineGetTransfer(server.api_url, 8000);
  } catch {
    return false;
  }
  const { data } = await supabase
    .from('vpn_keys')
    .select('id,outline_key_id,used_bytes')
    .eq('vpn_server_id', server.id)
    .eq('is_current', true)
    .limit(5000);
  for (const k of (data ?? []) as any[]) {
    const live = usage[String(k.outline_key_id)];
    if (live === undefined) continue;
    if (num(live) !== num(k.used_bytes)) {
      await supabase.from('vpn_keys').update({ used_bytes: num(live) }).eq('id', k.id);
    }
  }
  await supabase.from('vpn_servers').update({ last_usage_sync_at: new Date().toISOString() }).eq('id', server.id);
  return true;
}

// ─── Status page view ───────────────────────────────────

export type VpnStatusView = {
  code: string;
  active: boolean;
  planName: string | null;
  country: string | null;
  serverName: string | null;
  startsAt: string;
  expiresAt: string;
  daysRemaining: number;
  dataLimitBytes: number;
  usedBytes: number;
  periodResetsAt: string | null; // null when the period ends with the plan
  dynamicKey: string;
  subscriptionLink: string;
  ssUri: string | null;
  replacementsLeft: number;
  /** Server problem known to us: show "updating our server" instead of replacing. */
  maintenance: boolean;
};

export async function getStatusView(code: string): Promise<VpnStatusView | null> {
  const supabase = getServiceSupabaseClient();
  const sub = await getSubscriptionByCode(code);
  if (!sub) return null;
  const active = !isExpired(sub);
  let key = active ? await getCurrentKey(sub.id) : null;
  const server = key ? await getServer(key.vpn_server_id) : null;

  // Fresh usage for this one key (short timeout so the page stays fast)
  if (key?.outline_key_id && server) {
    try {
      const live = (await outlineGetTransfer(server.api_url, 3500))[key.outline_key_id];
      if (live !== undefined && num(live) !== num(key.used_bytes)) {
        await supabase.from('vpn_keys').update({ used_bytes: num(live) }).eq('id', key.id);
        key = { ...key, used_bytes: num(live) };
      }
    } catch {
      /* show last synced value */
    }
  }

  const pEnd = periodEnd(sub);
  const expires = new Date(sub.expires_at);
  return {
    code: sub.code,
    active,
    planName: sub.plan_name,
    country: sub.country,
    serverName: server?.name ?? null,
    startsAt: sub.starts_at,
    expiresAt: sub.expires_at,
    daysRemaining: Math.max(0, Math.ceil((expires.getTime() - Date.now()) / DAY_MS)),
    dataLimitBytes: num(sub.data_limit_bytes),
    usedBytes: periodUsedBytes(sub, key),
    periodResetsAt: pEnd.getTime() < expires.getTime() - DAY_MS ? pEnd.toISOString() : null,
    dynamicKey: dynamicKeyFor(sub.code),
    subscriptionLink: subscriptionLinkFor(sub.code),
    ssUri: key?.ss_uri ?? null,
    replacementsLeft: active ? await replacementsLeft(sub.id) : 0,
    maintenance: isServerInMaintenance(server),
  };
}

/** JSON for the Outline app (dynamic access key). */
export async function getDynamicConfig(
  code: string
): Promise<{ config?: SsConfig; error?: string }> {
  const sub = await getSubscriptionByCode(code);
  if (!sub) return { error: 'Key not found. Please contact PremiumCity.' };
  if (isExpired(sub)) return { error: 'Your VPN plan has expired. Renew at PremiumCity (pcitystore.com).' };
  const key = await getCurrentKey(sub.id);
  const cfg = parseSsUri(key?.ss_uri);
  if (!cfg) return { error: 'Your key is being updated. Please try again in a few minutes.' };
  return { config: cfg };
}

/**
 * Data for the subscription link. Uses stored usage only (no Outline call):
 * Hiddify re-checks this often while the app is open, so it must be cheap.
 */
export async function getSubscriptionFeed(code: string): Promise<{
  found: boolean;
  active: boolean;
  ssUris: string[];
  usedBytes: number;
  totalBytes: number;
  expireUnix: number;
  statusUrl: string;
} | null> {
  const sub = await getSubscriptionByCode(code);
  if (!sub) return null;
  const active = !isExpired(sub);
  const key = active ? await getCurrentKey(sub.id) : null;
  const ssUris: string[] = [];
  if (key?.ss_uri) {
    const country = (sub.country || '').toUpperCase();
    const name = `PremiumCity${country ? ` ${country}` : ''}`;
    ssUris.push(`${key.ss_uri.split('#')[0]}#${encodeURIComponent(name)}`);
  }
  return {
    found: true,
    active,
    ssUris,
    usedBytes: periodUsedBytes(sub, key),
    totalBytes: Math.max(0, num(sub.data_limit_bytes)),
    expireUnix: Math.floor(new Date(sub.expires_at).getTime() / 1000),
    statusUrl: statusPageUrl(sub.code),
  };
}

// ─── Admin operations ───────────────────────────────────

/**
 * Move every active customer from one server to another, keeping expiry and
 * remaining data. Resumable: stops before Vercel's time limit and reports how
 * many are left, so the admin can press the button again.
 */
export async function moveAllCustomers(
  fromServerId: string,
  toServerId: string,
  budgetMs = 240_000
): Promise<{ moved: number; failed: number; remaining: number; errors: string[] }> {
  const started = Date.now();
  const supabase = getServiceSupabaseClient();
  const from = await getServer(fromServerId);
  const to = await getServer(toServerId);
  if (!from || !to) throw new Error('Server not found.');
  if (from.id === to.id) throw new Error('Pick a different server.');
  if (to.is_active === false) throw new Error('Target server is not active.');

  // Stop new sales on the old server right away.
  await supabase.from('vpn_servers').update({ accepting_new: false }).eq('id', from.id);

  // One usage snapshot + one health check for the whole batch.
  const alive = await outlinePing(from.api_url);
  let usage: Record<string, number> | null = null;
  if (alive) {
    try {
      usage = await outlineGetTransfer(from.api_url, 8000);
    } catch {
      usage = null;
    }
  }

  const { data: keys } = await supabase
    .from('vpn_keys')
    .select('id,subscription_id')
    .eq('vpn_server_id', from.id)
    .eq('is_current', true)
    .limit(5000);

  const subIds = Array.from(
    new Set(((keys ?? []) as any[]).map((k) => k.subscription_id).filter(Boolean))
  ) as string[];

  // Only active, unexpired plans need moving.
  const activeIds: string[] = [];
  for (let i = 0; i < subIds.length; i += 100) {
    const { data } = await supabase
      .from('vpn_subscriptions')
      .select('id,status,expires_at')
      .in('id', subIds.slice(i, i + 100));
    for (const s of (data ?? []) as any[]) if (!isExpired(s)) activeIds.push(s.id);
  }

  let moved = 0;
  let failed = 0;
  let busy = 0;
  let skippedOrMoved = 0; // processed in this run (moved, skipped, busy or failed)
  const errors: string[] = [];
  for (const id of activeIds) {
    if (Date.now() - started > budgetMs) break;
    skippedOrMoved++;
    const res = await rotateKey(id, {
      reason: 'server_move',
      targetServerId: to.id,
      knownUsage: usage ?? {},
      oldServerDead: !alive,
      onlyIfOnServerId: from.id,
    });
    if (res.ok) {
      if (!res.skipped) moved++;
    } else if (res.busy) {
      busy++; // another run is moving this one right now — count as remaining
    } else {
      failed++;
      if (errors.length < 5) errors.push(res.error);
    }
  }

  // Not reached because of the time budget, plus ones another run was busy with.
  const remaining = activeIds.length - skippedOrMoved + busy;
  if (remaining === 0 && failed === 0) {
    await supabase.from('vpn_servers').update({ is_active: false, pending_move_to: null }).eq('id', from.id);
    // The server we moved to now carries customers: let it take new sales.
    await supabase.from('vpn_servers').update({ accepting_new: true, is_backup: false }).eq('id', to.id);
  }
  return { moved, failed, remaining, errors };
}

export async function revokeSubscription(subscriptionId: string): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const key = await getCurrentKey(subscriptionId);
  if (key?.outline_key_id) {
    const server = await getServer(key.vpn_server_id);
    if (server) await outlineDeleteKey(server.api_url, key.outline_key_id);
  }
  if (key) {
    await supabase
      .from('vpn_keys')
      .update({ is_current: false, retired_at: new Date().toISOString(), retire_reason: 'revoked' })
      .eq('id', key.id);
  }
  await supabase.from('vpn_subscriptions').update({ status: 'revoked' }).eq('id', subscriptionId);
}

/** Add days to a plan. Re-creates a key if the plan had already expired. */
export async function extendSubscription(
  subscriptionId: string,
  days: number
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getServiceSupabaseClient();
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return { ok: false, error: 'Plan not found.' };
  const now = Date.now();
  const wasExpired = isExpired(sub);
  const base = Math.max(new Date(sub.expires_at).getTime(), now);
  const newExpiry = new Date(base + Math.round(days) * DAY_MS).toISOString();

  await supabase.from('vpn_subscriptions').update({ expires_at: newExpiry }).eq('id', sub.id);
  await supabase.from('vpn_keys').update({ expires_at: newExpiry }).eq('subscription_id', sub.id).eq('is_current', true);

  if (wasExpired && sub.status !== 'revoked') {
    const res = await rotateKey(sub.id, { reason: 'reactivate', newPeriodStart: new Date().toISOString() });
    if (!res.ok) return { ok: false, error: res.error };
  }
  return { ok: true };
}

// ─── Daily maintenance (cron) ───────────────────────────

export async function runDailyMaintenance(budgetMs = 250_000): Promise<Record<string, number>> {
  const started = Date.now();
  const supabase = getServiceSupabaseClient();
  const stats = { serversSynced: 0, serversDown: 0, expired: 0, periodReset: 0, errors: 0 };

  const servers = await listServers();
  const deadServers = new Set<string>();
  for (const s of servers) {
    if (s.is_active === false) continue;
    if (await syncServerUsage(s)) stats.serversSynced++;
    else {
      stats.serversDown++;
      deadServers.add(s.id);
    }
  }

  const { data: subs } = await supabase
    .from('vpn_subscriptions')
    .select(SUB_COLS)
    .eq('status', 'active')
    .limit(5000);

  for (const sub of (subs ?? []) as VpnSubscription[]) {
    if (Date.now() - started > budgetMs) break;
    try {
      const now = Date.now();
      if (new Date(sub.expires_at).getTime() <= now) {
        // Expired: remove the key from the server, close the plan.
        const key = await getCurrentKey(sub.id);
        if (key?.outline_key_id && key.vpn_server_id && !deadServers.has(key.vpn_server_id)) {
          const server = servers.find((x) => x.id === key.vpn_server_id);
          if (server) await outlineDeleteKey(server.api_url, key.outline_key_id);
        }
        if (key) {
          await supabase
            .from('vpn_keys')
            .update({ is_current: false, retired_at: new Date().toISOString(), retire_reason: 'expired' })
            .eq('id', key.id);
        }
        await supabase.from('vpn_subscriptions').update({ status: 'expired' }).eq('id', sub.id);
        stats.expired++;
        continue;
      }

      // New 30-day period inside a multi-month plan: fresh key with full data.
      const pDays = sub.period_days || 30;
      let pStart = new Date(sub.period_started_at).getTime();
      if (pStart + pDays * DAY_MS <= now) {
        while (pStart + pDays * DAY_MS <= now) pStart += pDays * DAY_MS;
        const key = await getCurrentKey(sub.id);
        const res = await rotateKey(sub.id, {
          reason: 'new_period',
          newPeriodStart: new Date(pStart).toISOString(),
          oldServerDead: !!key?.vpn_server_id && deadServers.has(key.vpn_server_id),
        });
        if (res.ok) stats.periodReset++;
        else stats.errors++;
      }
    } catch (e) {
      console.error('[vpn-daily] subscription failed', sub.id, e);
      stats.errors++;
    }
  }

  // Server reminders: paid month ending, or server not answering.
  const today = new Date();
  for (const s of servers) {
    if (s.is_active === false) continue;
    const lines: string[] = [];
    if (s.paid_until) {
      const daysLeft = Math.ceil((new Date(s.paid_until).getTime() - today.getTime()) / DAY_MS);
      if (daysLeft <= 3) {
        lines.push(
          daysLeft < 0
            ? `⏰ Paid period ended ${-daysLeft} day(s) ago.`
            : `⏰ Paid until ${s.paid_until} (${daysLeft} day(s) left).`
        );
      }
    }
    if (lines.length) {
      await sendTelegramMessage({
        text: [
          `🖥 <b>VPN server: ${escapeHtml(s.name || s.country || 'server')}</b>`,
          ...lines,
          '',
          'Buy the new server, add it in VPN admin, then press "Move all customers".',
        ].join('\n'),
        buttons: [[{ text: '🔗 VPN admin', url: `${siteUrl()}/admin/vpn` }]],
      }).catch(() => false);
    }
  }

  return stats;
}

// ─── Orders page enrichment ─────────────────────────────

/**
 * Add the status link + permanent key to every VPN key shown on order pages,
 * and use the plan's expiry / this-period usage (a plan outlives its keys).
 * Never throws: order pages must load even if this fails.
 */
export async function attachVpnStatus(orders: { items: any[] }[]): Promise<void> {
  try {
    const keys: any[] = [];
    for (const o of orders) for (const it of o.items ?? []) for (const k of it.vpnKeys ?? []) keys.push(k);
    const ids = Array.from(new Set(keys.map((k) => k.subscriptionId).filter(Boolean))) as string[];
    if (!ids.length) return;

    const supabase = getServiceSupabaseClient();
    const subById: Record<string, any> = {};
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase
        .from('vpn_subscriptions')
        .select('id,code,expires_at,data_limit_bytes,period_used_prior_bytes,status')
        .in('id', ids.slice(i, i + 100));
      for (const s of (data ?? []) as any[]) subById[s.id] = s;
    }

    for (const o of orders) {
      for (const it of o.items ?? []) {
        for (const k of it.vpnKeys ?? []) {
          const sub = k.subscriptionId ? subById[k.subscriptionId] : null;
          if (!sub) continue;
          const active = !isExpired(sub);
          k.expiresAt = sub.expires_at;
          k.dataLimitBytes = num(sub.data_limit_bytes);
          k.usedBytes = num(sub.period_used_prior_bytes) + num(k.usedBytes);
          k.statusUrl = statusPageUrl(sub.code);
          k.dynamicKey = active ? dynamicKeyFor(sub.code) : null;
        }
        const first = (it.vpnKeys ?? [])[0];
        if (first?.statusUrl) {
          it.vpnExpiresAt = first.expiresAt;
          it.vpnDataLimitBytes = first.dataLimitBytes;
          it.vpnUsedBytes = first.usedBytes;
        }
      }
    }
  } catch (e) {
    console.warn('attachVpnStatus failed:', e);
  }
}

// ─── Health checks, backup failover (semi-automatic) ────

const MOVE_CB_PREFIX = 'vpnmv:'; // Telegram button: vpnmv:<serverId>
const BLOCKED_THRESHOLD = 3; // different customers replacing keys…
const BLOCKED_WINDOW_MIN = 60; // …on the same server within this many minutes

function moveButtons(serverId: string) {
  return [
    [{ text: '🔁 Move all to backup', callback_data: `${MOVE_CB_PREFIX}${serverId}` }],
    [{ text: '🔗 VPN admin', url: `${siteUrl()}/admin/vpn` }],
  ];
}

async function customersOnServer(serverId: string): Promise<number> {
  const supabase = getServiceSupabaseClient();
  const { data } = await supabase
    .from('vpn_keys')
    .select('id')
    .eq('vpn_server_id', serverId)
    .eq('is_current', true)
    .limit(5000);
  return ((data ?? []) as any[]).length;
}

/** Best live backup for a server: same country first. */
export async function findBackupFor(serverId: string): Promise<VpnServer | null> {
  const servers = await listServers();
  const down = servers.find((s) => s.id === serverId);
  const c = String(down?.country || '').toUpperCase();
  const candidates = servers
    .filter((s) => s.id !== serverId && s.is_active !== false && s.is_backup === true && !s.pending_move_to)
    .sort((a, b) => {
      const sa = String(a.country || '').toUpperCase() === c ? 0 : 1;
      const sb = String(b.country || '').toUpperCase() === c ? 0 : 1;
      return sa - sb;
    });
  for (const b of candidates) {
    if (await outlinePing(b.api_url)) return b;
  }
  return null;
}

/** Queue "move all customers" from a server to its backup (Telegram button / admin). */
export async function queueMoveToBackup(
  serverId: string
): Promise<{ ok: boolean; error?: string; fromName?: string; toName?: string }> {
  const supabase = getServiceSupabaseClient();
  const from = await getServer(serverId);
  if (!from) return { ok: false, error: 'Server not found.' };
  if (from.pending_move_to) {
    const to = await getServer(from.pending_move_to);
    return { ok: true, fromName: from.name ?? '', toName: to?.name ?? '' };
  }
  const backup = await findBackupFor(serverId);
  if (!backup) {
    return { ok: false, error: 'No working backup server. Add one in VPN admin and mark it as Backup.' };
  }
  await supabase
    .from('vpn_servers')
    .update({ pending_move_to: backup.id, accepting_new: false })
    .eq('id', serverId);
  return { ok: true, fromName: from.name ?? '', toName: backup.name ?? '' };
}

/** Run queued moves (called by the Telegram button and every health check). */
export async function processPendingMoves(budgetMs: number): Promise<void> {
  const started = Date.now();
  const servers = await listServers();
  for (const from of servers.filter((s) => s.pending_move_to)) {
    const left = budgetMs - (Date.now() - started);
    if (left < 15_000) break;
    const to = servers.find((s) => s.id === from.pending_move_to);
    try {
      const r = await moveAllCustomers(from.id, from.pending_move_to as string, left - 5_000);
      if (r.remaining === 0) {
        if (r.failed > 0) {
          // Leave the queue cleared; admin decides about the failures.
          await getServiceSupabaseClient().from('vpn_servers').update({ pending_move_to: null }).eq('id', from.id);
        }
        await sendTelegramMessage({
          text: [
            r.failed === 0 ? '✅ <b>Moved to backup</b>' : '⚠️ <b>Move finished with errors</b>',
            '',
            `🖥 ${escapeHtml(from.name || 'server')} → <b>${escapeHtml(to?.name || 'backup')}</b>`,
            `👥 Moved: ${r.moved}${r.failed ? ` · Failed: ${r.failed}` : ''}`,
            r.failed ? `Errors: ${escapeHtml(r.errors.join(' | '))}` : 'Expiry dates and remaining data kept. Outline users switch on reconnect; Hiddify/V2Box within 1 hour.',
          ].join('\n'),
          buttons: [[{ text: '🔗 VPN admin', url: `${siteUrl()}/admin/vpn` }]],
        }).catch(() => false);
      }
    } catch (e) {
      console.error('[vpn] pending move failed', from.id, e);
    }
  }
}

/** Several different customers replaced keys on one server recently → maybe blocked. */
async function checkMaybeBlocked(serverId: string): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const server = await getServer(serverId);
  if (!server) return;
  if (server.blocked_alerted_at && Date.now() - new Date(server.blocked_alerted_at).getTime() < 3 * 60 * 60 * 1000) {
    return; // alerted in the last 3 hours
  }
  const { data } = await supabase
    .from('vpn_key_replacements')
    .select('subscription_id,created_at')
    .eq('from_server_id', serverId)
    .eq('reason', 'customer_request')
    .order('created_at', { ascending: false })
    .limit(100);
  const since = Date.now() - BLOCKED_WINDOW_MIN * 60 * 1000;
  const subs = new Set(
    ((data ?? []) as any[]).filter((r) => new Date(r.created_at).getTime() > since).map((r) => r.subscription_id)
  );
  if (subs.size < BLOCKED_THRESHOLD) return;

  await supabase.from('vpn_servers').update({ blocked_alerted_at: new Date().toISOString() }).eq('id', serverId);
  await sendTelegramMessage({
    text: [
      '🚧 <b>Customers report a bad line</b>',
      '',
      `🖥 <b>${escapeHtml(server.name || 'server')}</b>`,
      `${subs.size} different customers replaced their key in the last ${BLOCKED_WINDOW_MIN} minutes.`,
      'The server still answers us, so local internet providers may be blocking it.',
      'Customers now see "We are updating our server" for 3 hours (no more key swaps).',
    ].join('\n'),
    buttons: moveButtons(serverId),
  }).catch(() => false);
}

/**
 * Every 5 minutes: ping each active server. Alert after 2 failed checks in a
 * row (with a one-tap "Move all to backup" button), say when it recovers,
 * save usage hourly, and continue any queued move.
 */
export async function runHealthChecks(budgetMs = 240_000): Promise<Record<string, number>> {
  const started = Date.now();
  const supabase = getServiceSupabaseClient();
  const stats = { checked: 0, down: 0, alerts: 0, recovered: 0, usageSynced: 0 };
  const servers = (await listServers()).filter((s) => s.is_active !== false);

  for (const s of servers) {
    stats.checked++;
    const alive = await outlinePing(s.api_url);
    const nowIso = new Date().toISOString();

    if (!alive) {
      stats.down++;
      const fails = (s.health_fail_count ?? 0) + 1;
      const patch: Record<string, unknown> = { health_fail_count: fails, last_health_at: nowIso };
      if (fails >= 2 && !s.down_alerted_at) {
        patch.down_alerted_at = nowIso;
        const customers = await customersOnServer(s.id);
        const isBackup = s.is_backup === true;
        await sendTelegramMessage({
          text: [
            isBackup ? '❌ <b>BACKUP server is down</b>' : '❌ <b>VPN server is DOWN</b>',
            '',
            `🖥 <b>${escapeHtml(s.name || 'server')}</b> (${escapeHtml(s.country || '?')})`,
            `Not answering for ${fails} checks (~${fails * 5} min).`,
            isBackup ? 'Failover will not work until it is back or you add another backup.' : `👥 ${customers} customer key(s) on this server.`,
          ].join('\n'),
          buttons: !isBackup && customers > 0 ? moveButtons(s.id) : [[{ text: '🔗 VPN admin', url: `${siteUrl()}/admin/vpn` }]],
        }).catch(() => false);
        stats.alerts++;
      }
      await supabase.from('vpn_servers').update(patch).eq('id', s.id);
      continue;
    }

    // Alive
    const patch: Record<string, unknown> = { health_fail_count: 0, last_health_at: nowIso };
    if (s.down_alerted_at) {
      patch.down_alerted_at = null;
      stats.recovered++;
      await sendTelegramMessage({
        text: `✅ <b>${escapeHtml(s.name || 'Server')}</b> is answering again.${
          s.pending_move_to ? ' (Move to backup already started — it will continue.)' : ''
        }`,
      }).catch(() => false);
    }
    await supabase.from('vpn_servers').update(patch).eq('id', s.id);

    // Save usage at most once an hour, so a dead server loses at most ~1h of usage.
    const lastSync = s.last_usage_sync_at ? new Date(s.last_usage_sync_at).getTime() : 0;
    if (Date.now() - lastSync > 55 * 60 * 1000 && Date.now() - started < budgetMs - 60_000) {
      if (await syncServerUsage(s)) stats.usageSynced++;
    }
  }

  await processPendingMoves(Math.max(0, budgetMs - (Date.now() - started)));
  return stats;
}
