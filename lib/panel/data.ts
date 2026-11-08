// lib/panel/data.ts
import crypto from 'crypto';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendEmail, tplPanelPasswordUpdated } from '@/lib/email';
import { CODE_WINDOW_MINUTES, customerLinkUrl } from './config';
import { classify, serviceInfo, htmlToText } from './rules';
import { normalizeEmail, parseEmail } from './mime';

export type PanelAccount = {
  id: string;
  service: string;
  email: string;
  password: string;
  profile: string | null;
  pin: string | null;
  account_expires_at: string | null;
  supplier: string | null;
  notes: string | null;
  status: string;
  password_updated_at: string | null;
  created_at: string;
  max_profiles: number | null;
};

export type PanelLink = {
  id: string;
  token: string;
  account_id: string;
  customer_name: string | null;
  customer_email: string | null;
  warranty_until: string;
  status: string;
  source: string;
  last_viewed_at: string | null;
  created_at: string;
  profile_name: string | null;
  profile_pin: string | null;
};

export type PanelEmail = {
  id: string;
  account_id: string | null;
  to_addresses: string | null;
  from_address: string | null;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  verdict: string;
  reason: string | null;
  code: string | null;
  action_link: string | null;
  received_at: string;
};

const ACC_COLS =
  'id,service,email,password,profile,pin,account_expires_at,supplier,notes,status,password_updated_at,created_at,max_profiles';
const LINK_COLS =
  'id,token,account_id,customer_name,customer_email,warranty_until,status,source,last_viewed_at,created_at,profile_name,profile_pin';
const MAIL_COLS =
  'id,account_id,to_addresses,from_address,subject,text_body,html_body,verdict,reason,code,action_link,received_at';

const db = () => getServiceSupabaseClient();

export function newToken(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function linkIsLive(link: Pick<PanelLink, 'status' | 'warranty_until'>): boolean {
  return link.status === 'active' && new Date(link.warranty_until).getTime() > Date.now();
}

// ── Accounts ─────────────────────────────────────────────

export async function listAccounts(q = ''): Promise<PanelAccount[]> {
  let query = db().from('panel_accounts').select(ACC_COLS).order('created_at', { ascending: false }).limit(300);
  const safe = q.trim().replace(/[,()*]/g, ' ');
  if (safe) query = query.or(`email.ilike.*${safe}*,supplier.ilike.*${safe}*,notes.ilike.*${safe}*`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PanelAccount[];
}

export async function getAccount(id: string): Promise<PanelAccount | null> {
  const { data } = await db().from('panel_accounts').select(ACC_COLS).eq('id', id).maybeSingle();
  return (data as PanelAccount) ?? null;
}

export async function createAccount(a: Partial<PanelAccount>): Promise<PanelAccount> {
  const { data, error } = await db()
    .from('panel_accounts')
    .insert({
      service: a.service || 'crunchyroll',
      email: String(a.email || '').trim(),
      password: String(a.password || ''),
      profile: a.profile || null,
      pin: a.pin || null,
      account_expires_at: a.account_expires_at || null,
      supplier: a.supplier || null,
      notes: a.notes || null,
      max_profiles: a.max_profiles && a.max_profiles > 0 ? a.max_profiles : 5,
      status: 'active',
    })
    .select(ACC_COLS)
    .single();
  if (error || !data) throw error || new Error('Could not create account');
  return data as PanelAccount;
}

export async function updateAccount(id: string, patch: Partial<PanelAccount>): Promise<void> {
  const { error } = await db().from('panel_accounts').update(patch).eq('id', id);
  if (error) throw error;
}

/**
 * Change the password. Every customer link shows it immediately; customers
 * with an email on a live link get notified.
 */
export async function changePassword(
  id: string,
  newPassword: string,
  opts: { notify: boolean; note?: string }
): Promise<{ emailed: number; failed: number }> {
  const acc = await getAccount(id);
  if (!acc) throw new Error('Account not found');
  await updateAccount(id, { password: newPassword, password_updated_at: new Date().toISOString() } as any);

  let emailed = 0;
  let failed = 0;
  if (opts.notify) {
    const links = (await listLinks(id)).filter((l) => linkIsLive(l) && l.customer_email);
    const svc = serviceInfo(acc.service).name;
    for (const l of links) {
      const { subject, html, text } = tplPanelPasswordUpdated({
        name: l.customer_name || String(l.customer_email).split('@')[0],
        service: svc,
        linkUrl: customerLinkUrl(l.token),
        note: opts.note,
      });
      const res = await sendEmail({ to: String(l.customer_email), subject, html, text });
      if (res.ok) emailed++;
      else failed++;
    }
  }
  return { emailed, failed };
}

// ── Links ────────────────────────────────────────────────

export async function listLinks(accountId: string): Promise<PanelLink[]> {
  const { data } = await db()
    .from('panel_links')
    .select(LINK_COLS)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(200);
  return (data ?? []) as PanelLink[];
}

export async function countLiveLinksByAccount(): Promise<Record<string, number>> {
  const { data } = await db().from('panel_links').select('account_id,status,warranty_until').eq('status', 'active').limit(5000);
  const out: Record<string, number> = {};
  for (const l of (data ?? []) as any[]) if (linkIsLive(l)) out[l.account_id] = (out[l.account_id] ?? 0) + 1;
  return out;
}

export async function createLink(input: {
  accountId: string;
  customerName?: string | null;
  customerEmail?: string | null;
  warrantyUntil: string;
  source?: string;
  profileName?: string | null;
  profilePin?: string | null;
}): Promise<PanelLink> {
  const { data, error } = await db()
    .from('panel_links')
    .insert({
      token: newToken(),
      account_id: input.accountId,
      customer_name: input.customerName || null,
      customer_email: input.customerEmail || null,
      warranty_until: input.warrantyUntil,
      source: input.source || 'manual',
      profile_name: input.profileName || null,
      profile_pin: input.profilePin || null,
      status: 'active',
    })
    .select(LINK_COLS)
    .single();
  if (error || !data) throw error || new Error('Could not create link');
  return data as PanelLink;
}

export async function updateLink(id: string, patch: Partial<PanelLink>): Promise<void> {
  const { error } = await db().from('panel_links').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLink(id: string): Promise<void> {
  const { error } = await db().from('panel_links').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteAccount(id: string): Promise<void> {
  // panel_links cascade; panel_emails keep history with account_id → null
  const { error } = await db().from('panel_accounts').delete().eq('id', id);
  if (error) throw error;
}

export async function getLinkByToken(token: string): Promise<{ link: PanelLink; account: PanelAccount } | null> {
  if (!/^[A-Za-z0-9]{6,32}$/.test(token)) return null;
  const { data } = await db().from('panel_links').select(LINK_COLS).eq('token', token).maybeSingle();
  const link = (data as PanelLink) ?? null;
  if (!link) return null;
  const account = await getAccount(link.account_id);
  if (!account) return null;
  return { link, account };
}

export async function touchLink(id: string): Promise<void> {
  await db().from('panel_links').update({ last_viewed_at: new Date().toISOString() }).eq('id', id);
}

// ── Emails ───────────────────────────────────────────────

/** Store a forwarded email: match it to an account and decide allowed/blocked. */
export async function ingestEmail(raw: string, envelopeTo: string | null, envelopeFrom: string | null) {
  const p = parseEmail(raw, envelopeTo);
  const from = p.from || envelopeFrom || '';

  // Match to an account by any recipient address (Gmail dots/+tags ignored).
  const wanted = new Set(p.addresses.map(normalizeEmail));
  let account: PanelAccount | null = null;
  if (wanted.size) {
    const { data } = await db().from('panel_accounts').select(ACC_COLS).eq('status', 'active').limit(2000);
    account = ((data ?? []) as PanelAccount[]).find((a) => wanted.has(normalizeEmail(a.email))) ?? null;
  }

  const c = classify(account?.service ?? null, from, p.subject, p.text, p.html, account?.email ?? null);
  const verdict = account ? c.verdict : 'blocked';
  const reason = account ? c.reason : 'No matching account';

  const { error } = await db()
    .from('panel_emails')
    .insert({
      account_id: account?.id ?? null,
      to_addresses: p.addresses.join(', ').slice(0, 1000),
      from_address: from.slice(0, 300),
      subject: p.subject.slice(0, 500),
      text_body: (p.text || htmlToText(p.html)).slice(0, 20000),
      html_body: p.html.slice(0, 200000),
      verdict,
      reason,
      code: c.code,
      action_link: verdict === 'allowed' ? c.link : null,
    });
  if (error) throw error;
  return { matched: !!account, verdict };
}

export async function listEmails(opts: { accountId?: string; limit?: number } = {}): Promise<PanelEmail[]> {
  let q = db().from('panel_emails').select(MAIL_COLS).order('received_at', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.accountId) q = q.eq('account_id', opts.accountId);
  const { data } = await q;
  return (data ?? []) as PanelEmail[];
}

/** Allowed emails for an account in the code window (what customers may see). */
export async function recentAllowedEmails(accountId: string): Promise<PanelEmail[]> {
  const { data } = await db()
    .from('panel_emails')
    .select(MAIL_COLS)
    .eq('account_id', accountId)
    .eq('verdict', 'allowed')
    .order('received_at', { ascending: false })
    .limit(10);
  const since = Date.now() - CODE_WINDOW_MINUTES * 60 * 1000;
  return ((data ?? []) as PanelEmail[]).filter((m) => new Date(m.received_at).getTime() > since);
}

/** Re-run the rules on a stored email (after a rule fix, or when an account was added later). */
export async function recheckEmail(id: string): Promise<void> {
  const { data } = await db().from('panel_emails').select(MAIL_COLS).eq('id', id).maybeSingle();
  const m = data as PanelEmail | null;
  if (!m) return;
  let account: PanelAccount | null = m.account_id ? await getAccount(m.account_id) : null;
  if (!account) {
    const wanted = new Set(String(m.to_addresses || '').split(',').map((x) => normalizeEmail(x.trim())).filter(Boolean));
    const { data: accs } = await db().from('panel_accounts').select(ACC_COLS).eq('status', 'active').limit(2000);
    account = ((accs ?? []) as PanelAccount[]).find((a) => wanted.has(normalizeEmail(a.email))) ?? null;
  }
  const c = classify(account?.service ?? null, m.from_address || '', m.subject || '', m.text_body || '', m.html_body || '', account?.email ?? null);
  const verdict = account ? c.verdict : 'blocked';
  await db()
    .from('panel_emails')
    .update({
      account_id: account?.id ?? null,
      verdict,
      reason: account ? c.reason : 'No matching account',
      code: c.code,
      action_link: verdict === 'allowed' ? c.link : null,
    })
    .eq('id', id);
}
