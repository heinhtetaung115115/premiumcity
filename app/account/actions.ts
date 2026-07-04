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
  const { error } = await supabase.from('users').update({ name }).eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/');
  return { success: true };
}

/**
 * Update profile photo. Accepts a base64 data URL (small images only).
 * Stored directly in users.avatar_url.
 */
export async function updateAvatarAction(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const dataUrl = String(formData.get('avatar') ?? '');

  if (!dataUrl.startsWith('data:image/')) {
    return { success: false, error: 'Invalid image.' };
  }

  // Limit ~500KB base64 (roughly 375KB actual image) to keep the DB row small
  if (dataUrl.length > 700_000) {
    return { success: false, error: 'Image too large. Please choose a smaller photo (under ~350KB).' };
  }

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: dataUrl })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/');
  return { success: true };
}

export async function removeAvatarAction() {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const supabase = getServiceSupabaseClient();
  const { error } = await supabase
    .from('users')
    .update({ avatar_url: null })
    .eq('id', userId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath('/account');
  revalidatePath('/');
  return { success: true };
}
