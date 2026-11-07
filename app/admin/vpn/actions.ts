'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { outlinePing } from '@/lib/outline';
import {
  createSubscription,
  dynamicKeyFor,
  extendSubscription,
  moveAllCustomers,
  revokeSubscription,
  rotateKey,
  statusPageUrl,
} from '@/lib/vpn';

type Result = { ok: boolean; error?: string; message?: string; link?: string; key?: string };

const GB = 1_000_000_000;

export async function addServerAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim().toUpperCase();
  const apiUrl = String(formData.get('apiUrl') ?? '').trim().replace(/\/+$/, '');
  const paidUntil = String(formData.get('paidUntil') ?? '').trim();

  if (!name || !country || !apiUrl) return { ok: false, error: 'Name, country and API URL are required.' };
  if (!/^https:\/\//i.test(apiUrl)) return { ok: false, error: 'API URL must start with https:// (copy it from Outline Manager).' };

  const alive = await outlinePing(apiUrl);
  if (!alive) {
    return { ok: false, error: 'Could not reach this Outline server. Check the API URL and that the server is running.' };
  }

  const supabase = getServiceSupabaseClient();
  const isBackup = formData.get('isBackup') === 'on';
  const { error } = await supabase.from('vpn_servers').insert({
    name,
    country,
    api_url: apiUrl,
    paid_until: paidUntil || null,
    is_active: true,
    accepting_new: !isBackup,
    is_backup: isBackup,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/vpn');
  return { ok: true, message: `Server ${name} added.` };
}

export async function updateServerAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get('serverId') ?? '');
  if (!id) return { ok: false, error: 'Missing server.' };
  const patch: Record<string, unknown> = {};
  if (formData.has('paidUntil')) patch.paid_until = String(formData.get('paidUntil') || '') || null;
  if (formData.has('acceptingNew')) patch.accepting_new = formData.get('acceptingNew') === 'true';
  if (formData.has('isActive')) patch.is_active = formData.get('isActive') === 'true';
  if (formData.has('isBackup')) {
    const backup = formData.get('isBackup') === 'true';
    patch.is_backup = backup;
    patch.accepting_new = !backup; // backups stay empty until a failover
  }
  const supabase = getServiceSupabaseClient();
  const { error } = await supabase.from('vpn_servers').update(patch).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/vpn');
  return { ok: true };
}

export async function moveAllAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const from = String(formData.get('fromServerId') ?? '');
  const to = String(formData.get('toServerId') ?? '');
  if (!from || !to) return { ok: false, error: 'Pick the server to move to.' };
  try {
    const r = await moveAllCustomers(from, to);
    revalidatePath('/admin/vpn');
    const parts = [`Moved ${r.moved}.`];
    if (r.failed) parts.push(`Failed ${r.failed}: ${r.errors.join(' | ')}`);
    if (r.remaining > 0) parts.push(`${r.remaining} left — press Move again to continue.`);
    if (!r.failed && r.remaining === 0) parts.push('Done. Old server switched off.');
    return { ok: r.failed === 0, message: parts.join(' ') };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Move failed.' };
  }
}

export async function createManualKeyAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const note = String(formData.get('note') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim().toUpperCase() || null;
  const serverId = String(formData.get('serverId') ?? '').trim() || null;
  const dataGb = Number(formData.get('dataGb') ?? 0);
  const months = Number(formData.get('months') ?? 1);
  const planName = String(formData.get('planName') ?? '').trim();

  if (!note) return { ok: false, error: 'Add a customer note (name / Viber / Telegram).' };
  if (!Number.isFinite(months) || months < 1 || months > 24) return { ok: false, error: 'Months must be 1–24.' };
  if (!Number.isFinite(dataGb) || dataGb < 0) return { ok: false, error: 'Data must be 0 (unlimited) or more.' };

  try {
    const sub = await createSubscription({
      source: 'manual',
      customerNote: note,
      country,
      serverId,
      planName: planName || `${dataGb > 0 ? `${dataGb}GB` : 'Unlimited'} · ${months} month${months > 1 ? 's' : ''}`,
      dataLimitBytes: Math.round(dataGb * GB),
      durationDays: Math.round(months * 30),
    });
    revalidatePath('/admin/vpn');
    return { ok: true, link: statusPageUrl(sub.code), key: dynamicKeyFor(sub.code) };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Could not create key.' };
  }
}

export async function adminReplaceKeyAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get('subscriptionId') ?? '');
  const target = String(formData.get('targetServerId') ?? '') || null;
  const res = await rotateKey(id, { reason: 'admin', targetServerId: target });
  revalidatePath('/admin/vpn');
  return res.ok ? { ok: true, message: `New key on ${res.serverName ?? 'server'}.` } : { ok: false, error: res.error };
}

export async function extendAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get('subscriptionId') ?? '');
  const days = Number(formData.get('days') ?? 0);
  if (!id || !Number.isFinite(days) || days <= 0 || days > 730) {
    return { ok: false, error: 'Enter days (e.g. 30).' };
  }
  const res = await extendSubscription(id, days);
  revalidatePath('/admin/vpn');
  return res.ok ? { ok: true, message: `Extended ${days} days.` } : { ok: false, error: res.error };
}

export async function revokeAction(formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get('subscriptionId') ?? '');
  if (!id) return { ok: false, error: 'Missing plan.' };
  await revokeSubscription(id);
  revalidatePath('/admin/vpn');
  return { ok: true, message: 'Revoked. Key deleted.' };
}
