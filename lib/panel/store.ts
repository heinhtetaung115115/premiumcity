// lib/panel/store.ts
// PremiumCity store <-> account panel: suggest a free profile slot for a
// manual order, deliver it, and serve it on the store's Orders page.

import { getServiceSupabaseClient } from '@/lib/supabase';
import { deliverToOrderItem } from '@/lib/manualDelivery';
import { customerLinkUrl, CODE_WINDOW_MINUTES } from './config';
import {
  countLiveLinksByAccount,
  createLink,
  deleteLink,
  getAccount,
  linkIsLive,
  listAccounts,
  recentAllowedEmails,
  type PanelAccount,
} from './data';
import { serviceInfo } from './rules';
import { safeEmailView } from './sanitize';

const DAY = 86_400_000;

/** Which panel service a store product belongs to (by its name). */
export function panelServiceForProduct(productName: string | null | undefined): string | null {
  const n = String(productName || '').toLowerCase();
  if (n.includes('crunchyroll')) return 'crunchyroll';
  return null;
}

/** Warranty length from the variant name: "1 Month", "3 Months", "15 Days", "1 Year". */
export function warrantyDaysFromVariant(variantName: string | null | undefined): number {
  const v = String(variantName || '').toLowerCase();
  const n = Number((v.match(/(\d+)/) || [])[1] || 1);
  if (/year|yr/.test(v)) return n * 365;
  if (/week|wk/.test(v)) return n * 7;
  if (/day/.test(v)) return n;
  if (/month|mon|\bm\b/.test(v)) return n * 30;
  return 30;
}

/** Profile name the customer asked for, else a short name from their email. */
export function profileNameFromInput(input: Record<string, string> | null | undefined, email: string): string {
  if (input) {
    for (const [k, v] of Object.entries(input)) {
      if (/profile|name/i.test(k) && String(v || '').trim()) return String(v).trim().slice(0, 30);
    }
  }
  return (email.split('@')[0] || 'Customer').slice(0, 20);
}

export type SlotSuggestion = { account: PanelAccount; used: number; max: number; free: number };

/** Accounts with a free profile, fullest first (fill accounts before opening new ones). */
export async function suggestAccounts(service: string, limit = 3): Promise<SlotSuggestion[]> {
  const [accounts, live] = await Promise.all([listAccounts(), countLiveLinksByAccount()]);
  return accounts
    .filter((a) => a.service === service && a.status === 'active')
    .map((a) => {
      const used = live[a.id] ?? 0;
      const max = a.max_profiles ?? 5;
      return { account: a, used, max, free: Math.max(0, max - used) };
    })
    .filter((s) => s.free > 0)
    .filter((s) => !s.account.account_expires_at || new Date(s.account.account_expires_at).getTime() > Date.now())
    .sort((a, b) => b.used - a.used)
    .slice(0, limit);
}

/** Resolve an account from the 8-char id prefix used in Telegram buttons. */
export async function accountByPrefix(prefix: string): Promise<PanelAccount | null> {
  const accounts = await listAccounts();
  const hits = accounts.filter((a) => a.id.startsWith(prefix));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Give a manual order item a profile slot on `accountId` and deliver it:
 * creates the customer link (own profile + warranty), stores it on the order
 * item, emails the customer and completes the order.
 */
export async function deliverPanelSlot(input: {
  orderItemId: string;
  accountId: string;
  profileName?: string | null;
  profilePin?: string | null;
  days?: number | null;
}): Promise<{ ok: boolean; error?: string; profileName?: string; accountEmail?: string; linkUrl?: string }> {
  const supabase = getServiceSupabaseClient();
  const { data: item } = await supabase
    .from('order_items')
    .select('id,order_id,product_name,variant_name,product_type,manual_input')
    .eq('id', input.orderItemId)
    .maybeSingle();
  if (!item) return { ok: false, error: 'Order item not found' };
  const it = item as any;

  const { data: existing } = await supabase.from('inventory_items').select('id').eq('order_item_id', it.id).limit(1);
  if (((existing ?? []) as any[]).length > 0) return { ok: false, error: 'This order item is already delivered.' };

  const account = await getAccount(input.accountId);
  if (!account || account.status !== 'active') return { ok: false, error: 'Account not found or archived.' };
  const live = (await countLiveLinksByAccount())[account.id] ?? 0;
  if (live >= (account.max_profiles ?? 5)) return { ok: false, error: 'That account has no free profile slot.' };

  const { data: order } = await supabase.from('orders').select('user_id').eq('id', it.order_id).maybeSingle();
  const { data: user } = order
    ? await supabase.from('users').select('email,name').eq('id', (order as any).user_id).maybeSingle()
    : { data: null as any };
  const email = String((user as any)?.email || '');
  const profileName = (input.profileName || '').trim() || profileNameFromInput(it.manual_input, email || 'customer');
  const days = input.days && input.days > 0 ? input.days : warrantyDaysFromVariant(it.variant_name);

  const link = await createLink({
    accountId: account.id,
    customerName: (user as any)?.name || email.split('@')[0] || null,
    customerEmail: email || null,
    warrantyUntil: new Date(Date.now() + days * DAY).toISOString(),
    source: 'premiumcity',
    profileName,
    profilePin: (input.profilePin || '').trim() || null,
  });

  const res = await deliverToOrderItem(it.id, { type: 'account_panel', token: link.token, service: account.service });
  if (!res.ok) {
    await deleteLink(link.id);
    return { ok: false, error: res.error };
  }
  return { ok: true, profileName, accountEmail: account.email, linkUrl: customerLinkUrl(link.token) };
}

/** Everything the store's Orders page shows for an account_panel delivery. */
export async function getOrderPanelView(orderItemId: string, userId: string | null, withCodes: boolean) {
  const supabase = getServiceSupabaseClient();
  const { data: item } = await supabase.from('order_items').select('id,order_id').eq('id', orderItemId).maybeSingle();
  if (!item) return { status: 404, error: 'Not found' } as const;
  if (userId) {
    const { data: order } = await supabase.from('orders').select('user_id').eq('id', (item as any).order_id).maybeSingle();
    if (!order || (order as any).user_id !== userId) return { status: 404, error: 'Not found' } as const;
  }
  const { data: inv } = await supabase.from('inventory_items').select('payload').eq('order_item_id', orderItemId).limit(10);
  const payload = ((inv ?? []) as any[]).map((r) => r.payload).find((p) => p?.type === 'account_panel' && p?.token);
  if (!payload) return { status: 404, error: 'No account on this order.' } as const;

  const { data: linkRow } = await supabase
    .from('panel_links')
    .select('id,token,account_id,warranty_until,status,profile_name,profile_pin')
    .eq('token', String(payload.token))
    .maybeSingle();
  const link = linkRow as any;
  if (!link) return { status: 404, error: 'This account link was removed. Please contact us.' } as const;
  const account = await getAccount(link.account_id);
  if (!account) return { status: 404, error: 'This account was removed. Please contact us.' } as const;

  const svc = serviceInfo(account.service);
  const live = linkIsLive(link) && account.status === 'active';
  const view: any = {
    service: account.service,
    serviceName: svc.name,
    color: svc.color,
    live,
    warrantyUntil: link.warranty_until,
    linkUrl: customerLinkUrl(link.token),
    codeWindowMinutes: CODE_WINDOW_MINUTES,
  };
  if (live) {
    Object.assign(view, {
      email: account.email,
      password: account.password,
      profile: link.profile_name ?? account.profile,
      pin: link.profile_pin ?? account.pin,
      passwordUpdatedAt: account.password_updated_at,
    });
    if (withCodes) {
      const mails = await recentAllowedEmails(account.id);
      view.messages = mails.map((m) => ({
        id: m.id,
        subject: m.subject || '',
        code: m.code,
        link: m.action_link,
        receivedAt: m.received_at,
        html: safeEmailView(m.html_body, m.text_body, svc.senders).slice(0, 250_000),
      }));
    }
  }
  return { status: 200, view } as const;
}
