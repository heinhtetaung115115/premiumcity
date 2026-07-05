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

/**
 * Claim the one-time 1000 KS profile-completion reward.
 * Requires both a name and an avatar to be set.
 */
export async function claimProfileRewardAction() {
  const session = await requireAuth();
  const userId = session.user.id as string;
  const REWARD = 1000;

  const supabase = getServiceSupabaseClient();

  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('id,name,avatar_url,profile_reward_claimed')
    .eq('id', userId)
    .maybeSingle();

  if (userErr) return { success: false, error: userErr.message };
  const u = (userRow as any) ?? {};

  if (u.profile_reward_claimed) {
    return { success: false, error: 'Reward already claimed.' };
  }
  const hasName = typeof u.name === 'string' && u.name.trim().length >= 2;
  const hasAvatar = typeof u.avatar_url === 'string' && u.avatar_url.startsWith('data:image/');
  if (!hasName || !hasAvatar) {
    return { success: false, error: 'Add both your name and profile photo first.' };
  }

  const { error: claimErr } = await supabase
    .from('users')
    .update({ profile_reward_claimed: true })
    .eq('id', userId)
    .eq('profile_reward_claimed', false);

  if (claimErr) return { success: false, error: claimErr.message };

  try {
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id,balance')
      .eq('user_id', userId)
      .maybeSingle();

    let walletId: string;
    let newBalance = 0;

    if (!walletRow) {
      const { data: newWallet, error: createErr } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: REWARD })
        .select('id,balance')
        .maybeSingle();
      if (createErr) throw createErr;
      walletId = (newWallet as any).id;
      newBalance = Number((newWallet as any).balance ?? REWARD);
    } else {
      walletId = (walletRow as any).id;
      const current = Number((walletRow as any).balance ?? 0);
      const { error: updErr } = await supabase
        .from('wallets')
        .update({ balance: current + REWARD })
        .eq('id', walletId);
      if (updErr) throw updErr;
      newBalance = current + REWARD;
    }

    const { error: txErr } = await supabase.from('wallet_transactions').insert({
      wallet_id: walletId,
      amount: REWARD,
      direction: 'CREDIT',
      description: 'Profile completion bonus',
    });
    if (txErr) throw txErr;

    revalidatePath('/account');
    revalidatePath('/');
    return { success: true, newBalance };
  } catch (err: any) {
    await supabase
      .from('users')
      .update({ profile_reward_claimed: false })
      .eq('id', userId);
    return { success: false, error: err?.message || 'Could not credit reward. Try again.' };
  }
}

/** Mark the welcome popup as seen so it doesn't show again. */
export async function dismissWelcomePopupAction() {
  const session = await requireAuth();
  const userId = session.user.id as string;
  const supabase = getServiceSupabaseClient();
  await supabase.from('users').update({ welcome_popup_seen: true }).eq('id', userId);
  return { success: true };
}

/**
 * Change the logged-in user's password.
 * Requires the current password, and a new password (confirmed).
 */
export async function changePasswordAction(formData: FormData) {
  const bcrypt = (await import('bcryptjs')).default;
  const session = await requireAuth();
  const userId = session.user.id as string;

  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: 'Please fill in all fields.' };
  }
  if (newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters.' };
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: 'New passwords do not match.' };
  }
  if (newPassword === currentPassword) {
    return { success: false, error: 'New password must be different from the current one.' };
  }

  const supabase = getServiceSupabaseClient();

  // Load current hash
  const { data: userRow, error: loadErr } = await supabase
    .from('users')
    .select('id,password_hash')
    .eq('id', userId)
    .maybeSingle();

  if (loadErr) return { success: false, error: loadErr.message };
  const u = (userRow as any) ?? {};
  if (!u.password_hash) {
    return { success: false, error: 'Could not verify your account.' };
  }

  // Verify current password
  const ok = await bcrypt.compare(currentPassword, u.password_hash);
  if (!ok) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  // Hash + save new password
  const newHash = await bcrypt.hash(newPassword, 12);
  const { error: updErr } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', userId);

  if (updErr) return { success: false, error: updErr.message };

  return { success: true };
}
