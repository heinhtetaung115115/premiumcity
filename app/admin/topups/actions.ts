'use server';

import { revalidatePath } from 'next/cache';
import { approveTopup, rejectTopup } from '@/lib/orders';
import { requireAdmin } from '@/lib/session';

export async function processTopup(_: unknown, formData: FormData) {
  const session = await requireAdmin();
  const topupId = String(formData.get('topupId') ?? '');
  const action = String(formData.get('action') ?? '');
  const comment = String(formData.get('comment') ?? '');

  if (!topupId || !action) {
    return { success: false, error: 'Missing parameters' };
  }

  try {
    if (action === 'approve') {
      await approveTopup(topupId, session.user.id!);
    } else if (action === 'reject') {
      await rejectTopup(topupId, session.user.id!, comment);
    } else {
      return { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  revalidatePath('/admin/topups');
  revalidatePath('/(dashboard)/wallet');
  return { success: true };
}
