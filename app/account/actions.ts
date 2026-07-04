'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';

export async function updateUsernameAction(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const name = String(formData.get('name') ?? '').trim();

  if (name.length < 2) {
    return { success: false, error: 'Name must be at least 2 characters.' };
  }
  if (name.length > 40) {
    return { success: false, error: 'Name must be under 40 characters.' };
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('users')
    .update({ name })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/');
  return { success: true };
}
