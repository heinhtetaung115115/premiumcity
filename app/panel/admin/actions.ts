'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  checkPassword,
  createSessionValue,
  isPanelAdmin,
  panelBase,
  PANEL_COOKIE,
  sessionCookieOptions,
} from '@/lib/panel/auth';
import {
  changePassword,
  createAccount,
  createLink,
  deleteAccount,
  deleteLink,
  getAccount,
  moveActiveLinks,
  recheckEmail,
  updateAccount,
  updateLink,
} from '@/lib/panel/data';
import { checkRateLimit } from '@/lib/rate-limit';

const DAY = 86_400_000;

function guard() {
  if (!isPanelAdmin()) redirect(`${panelBase()}/admin/login`);
}

function dateInputToIso(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  // <input type="date"> gives YYYY-MM-DD; treat as end of that day in Myanmar time
  const d = new Date(`${s}T23:59:00+06:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function loginAction(formData: FormData) {
  const ip =
    headers().get('cf-connecting-ip') || headers().get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await checkRateLimit({ key: ip, route: 'panel-login', windowInSeconds: 900, maxRequests: 8 });
  const base = panelBase();
  if (!rl.allowed) redirect(`${base}/admin/login?e=limit`);
  if (!checkPassword(String(formData.get('password') ?? ''))) redirect(`${base}/admin/login?e=1`);
  cookies().set(PANEL_COOKIE, createSessionValue(), sessionCookieOptions());
  redirect(`${base}/admin`);
}

export async function logoutAction() {
  cookies().delete(PANEL_COOKIE);
  redirect(`${panelBase()}/admin/login`);
}

export async function createAccountAction(formData: FormData) {
  guard();
  const email = String(formData.get('email') ?? '').trim();
  if (!email) redirect(`${panelBase()}/admin?e=email`);
  const acc = await createAccount({
    service: String(formData.get('service') ?? 'crunchyroll'),
    email,
    password: String(formData.get('password') ?? ''),
    max_profiles: Math.max(1, Math.min(20, Number(formData.get('maxProfiles') ?? 5) || 5)),
    account_expires_at: dateInputToIso(formData.get('accountExpires')),
    supplier: String(formData.get('supplier') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
  });
  redirect(`${panelBase()}/admin/a/${acc.id}`);
}

export async function updateAccountAction(formData: FormData) {
  guard();
  const id = String(formData.get('id') ?? '');
  await updateAccount(id, {
    service: String(formData.get('service') ?? 'crunchyroll'),
    email: String(formData.get('email') ?? '').trim(),
    max_profiles: Math.max(1, Math.min(20, Number(formData.get('maxProfiles') ?? 5) || 5)),
    account_expires_at: dateInputToIso(formData.get('accountExpires')),
    supplier: String(formData.get('supplier') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    status: String(formData.get('status') ?? 'active'),
  } as any);
  revalidatePath('/panel/admin');
  redirect(`${panelBase()}/admin/a/${id}?ok=saved`);
}

export async function changePasswordAction(formData: FormData) {
  guard();
  const id = String(formData.get('id') ?? '');
  const pw = String(formData.get('password') ?? '');
  if (!pw) redirect(`${panelBase()}/admin/a/${id}?e=pw`);
  const acc = await getAccount(id);
  if (acc && acc.password === pw) redirect(`${panelBase()}/admin/a/${id}?e=same`);
  const res = await changePassword(id, pw, {
    notify: formData.get('notify') === 'on',
    note: String(formData.get('note') ?? '').trim() || undefined,
  });
  redirect(`${panelBase()}/admin/a/${id}?ok=pw&sent=${res.emailed}&failed=${res.failed}`);
}

export async function createLinkAction(formData: FormData) {
  guard();
  const accountId = String(formData.get('accountId') ?? '');
  const days = Number(formData.get('days') ?? 30);
  const until =
    dateInputToIso(formData.get('until')) ||
    new Date(Date.now() + Math.max(1, Math.min(730, days || 30)) * DAY).toISOString();
  const email = String(formData.get('customerEmail') ?? '').trim();
  const link = await createLink({
    accountId,
    customerName: String(formData.get('customerName') ?? '').trim() || null,
    customerEmail: email || null,
    warrantyUntil: until,
    profileName: String(formData.get('profileName') ?? '').trim() || null,
    profilePin: String(formData.get('profilePin') ?? '').trim() || null,
  });
  redirect(`${panelBase()}/admin/a/${accountId}?new=${link.token}`);
}

export async function extendLinkAction(formData: FormData) {
  guard();
  const id = String(formData.get('linkId') ?? '');
  const accountId = String(formData.get('accountId') ?? '');
  const currentUntil = String(formData.get('currentUntil') ?? '');
  const days = Math.max(1, Math.min(730, Number(formData.get('days') ?? 30) || 30));
  const base = Math.max(Date.now(), new Date(currentUntil).getTime() || 0);
  await updateLink(id, {
    warranty_until: new Date(base + days * DAY).toISOString(),
    status: 'active',
    expiry_handled_at: null,
  } as any);
  redirect(`${panelBase()}/admin/a/${accountId}?ok=extended`);
}

export async function revokeLinkAction(formData: FormData) {
  guard();
  const id = String(formData.get('linkId') ?? '');
  const accountId = String(formData.get('accountId') ?? '');
  await updateLink(id, { status: 'revoked' } as any);
  redirect(`${panelBase()}/admin/a/${accountId}?ok=revoked`);
}

export async function recheckEmailAction(formData: FormData) {
  guard();
  await recheckEmail(String(formData.get('emailId') ?? ''));
  redirect(`${panelBase()}/admin/inbox?ok=rechecked`);
}

export async function updateLinkProfileAction(formData: FormData) {
  guard();
  const id = String(formData.get('linkId') ?? '');
  const accountId = String(formData.get('accountId') ?? '');
  await updateLink(id, {
    profile_name: String(formData.get('profileName') ?? '').trim() || null,
    profile_pin: String(formData.get('profilePin') ?? '').trim() || null,
    customer_name: String(formData.get('customerName') ?? '').trim() || null,
    customer_email: String(formData.get('customerEmail') ?? '').trim() || null,
  } as any);
  redirect(`${panelBase()}/admin/a/${accountId}?ok=profile`);
}

export async function setLinkUntilAction(formData: FormData) {
  guard();
  const id = String(formData.get('linkId') ?? '');
  const accountId = String(formData.get('accountId') ?? '');
  const until = dateInputToIso(formData.get('until'));
  if (!until) redirect(`${panelBase()}/admin/a/${accountId}`);
  const patch: Record<string, unknown> = { warranty_until: until, expiry_handled_at: null };
  // Setting a future date on a revoked link brings it back.
  if (new Date(until as string).getTime() > Date.now()) patch.status = 'active';
  await updateLink(id, patch as any);
  redirect(`${panelBase()}/admin/a/${accountId}?ok=date`);
}

export async function deleteLinkAction(formData: FormData) {
  guard();
  const id = String(formData.get('linkId') ?? '');
  const accountId = String(formData.get('accountId') ?? '');
  await deleteLink(id);
  redirect(`${panelBase()}/admin/a/${accountId}?ok=deleted`);
}

export async function deleteAccountAction(formData: FormData) {
  guard();
  if (formData.get('confirm') !== 'on') redirect(`${panelBase()}/admin`);
  await deleteAccount(String(formData.get('id') ?? ''));
  redirect(`${panelBase()}/admin?ok=deleted`);
}

export async function moveCustomersAction(formData: FormData) {
  guard();
  const fromId = String(formData.get('fromId') ?? '');
  const toId = String(formData.get('toId') ?? '');
  if (!toId || toId === fromId) redirect(`${panelBase()}/admin/a/${fromId}?e=move`);
  const moved = await moveActiveLinks(fromId, toId);
  if (formData.get('archiveOld') === 'on') await updateAccount(fromId, { status: 'archived' } as any);
  redirect(`${panelBase()}/admin/a/${toId}?ok=moved&n=${moved}`);
}

export async function markExpiryDoneAction(formData: FormData) {
  guard();
  const { markExpiryHandled } = await import('@/lib/panel/expiry');
  await markExpiryHandled(String(formData.get('linkId') ?? ''));
  redirect(`${panelBase()}/admin?ok=jobdone`);
}
