'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';

export async function deleteSlipAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  await getServiceSupabaseClient().from('used_slips').delete().eq('id', id);
  revalidatePath('/admin/slips');
}
