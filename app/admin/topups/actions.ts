'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { approveTopup, rejectTopup, TopupAlreadyProcessedError } from '@/lib/wallet';

export async function processTopup(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  const actionRaw = String(formData.get('action') ?? '');
  const action = actionRaw.toUpperCase(); // APPROVE | REJECT
  const reason = String(formData.get('reason') ?? '').trim() || undefined;

  if (!id || (action !== 'APPROVE' && action !== 'REJECT')) {
    return { success: false, error: 'Invalid action' };
  }

  try {
    if (action === 'APPROVE') {
      await approveTopup(id, false);
    } else {
      await rejectTopup(id, reason, false);
    }
  } catch (err: any) {
    if (err instanceof TopupAlreadyProcessedError) {
      return { success: false, error: 'This top-up was already processed.' };
    }
    console.error('processTopup error:', err);
    return { success: false, error: err?.message ?? 'Failed to process top-up' };
  }

  revalidatePath('/admin/topups');
  revalidatePath('/admin');
  revalidatePath('/(dashboard)/wallet');

  return { success: true };
}
