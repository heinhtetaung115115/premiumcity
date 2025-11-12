'use server';

import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/session';
import { submitTopupRequest } from '@/lib/wallet';
import { topupSchema } from '@/utils/validators';

export async function requestTopup(_: unknown, formData: FormData) {
  const session = await requireAuth();
  const parsed = topupSchema.safeParse({
    bankName: formData.get('bankName'),
    amount: formData.get('amount'),
    referenceHint: formData.get('referenceHint'),
    note: formData.get('note')
  });

  if (!parsed.success) {
    return { success: false, error: 'Invalid top up submission' };
  }

  await submitTopupRequest({
    userId: session.user.id!,
    amount: parsed.data.amount,
    bankName: parsed.data.bankName,
    referenceHint: parsed.data.referenceHint,
    note: parsed.data.note
  });

  redirect('/(dashboard)/wallet?topup=submitted');
}
