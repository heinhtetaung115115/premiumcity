'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { adminCreditWallet } from '@/lib/wallet';

export type AdminCreditResult = { ok: boolean; error?: string; balance?: number };

export async function adminCreditWalletAction(
  formData: FormData
): Promise<AdminCreditResult> {
  const session = await requireAdmin();
  const adminEmail = (session?.user?.email as string) || undefined;

  const userId = String(formData.get('userId') ?? '').trim();
  const amount = Number(formData.get('amount') ?? 0);
  const reason = String(formData.get('reason') ?? '').trim();

  if (!userId) return { ok: false, error: 'Missing user.' };
  if (!reason) return { ok: false, error: 'Please add a reason (for the record).' };

  const result = await adminCreditWallet({ userId, amount, reason, adminEmail });

  if (result.ok) {
    revalidatePath(`/admin/users`);
  }
  return result;
}
