'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { approveRenewal, rejectRenewal, updateNetflixLink } from '@/lib/netflixRenewal';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';

export async function approveRenewalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('renewalId') ?? '');
  if (!id) return;
  await approveRenewal(id);
  revalidatePath('/admin/renewals');
}

export async function rejectRenewalAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('renewalId') ?? '');
  if (!id) return;
  const res = await rejectRenewal(id);
  if (res.ok) {
    try {
      await sendTelegramMessage({
        text: `↩️ <b>Netflix renewal rejected & refunded</b>\nRenewal: ${id}`,
      });
    } catch {
      /* best effort */
    }
  }
  revalidatePath('/admin/renewals');
}

export async function updateNetflixLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const orderItemId = String(formData.get('orderItemId') ?? '');
  const link = String(formData.get('link') ?? '').trim();
  if (!orderItemId || !link) return;
  await updateNetflixLink(orderItemId, link);
  revalidatePath('/admin/renewals');
}
