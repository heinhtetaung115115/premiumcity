'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { saveRateSettings, refreshCryptoRate, getRateSettings } from '@/lib/cryptoRate';

export async function saveSettingsAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const manualEnabled = String(formData.get('manualEnabled') ?? '') === 'on';
  const raw = String(formData.get('manualUsdtMmk') ?? '').trim();
  const manualUsdtMmk = raw ? Number(raw) : null;

  // getAll → the payment-method checkboxes
  const payTypes = formData
    .getAll('payTypes')
    .map((v) => String(v))
    .filter(Boolean);

  const current = await getRateSettings();

  await saveRateSettings({
    manualEnabled,
    manualUsdtMmk:
      manualUsdtMmk && Number.isFinite(manualUsdtMmk) && manualUsdtMmk > 0
        ? manualUsdtMmk
        : current.manualUsdtMmk,
    payTypes,
  });

  revalidatePath('/admin/crypto-rate');
}

export async function refreshNowAction(): Promise<void> {
  await requireAdmin();
  const r = await refreshCryptoRate();
  console.log('[admin/crypto-rate] refresh:', r.message);
  revalidatePath('/admin/crypto-rate');
}
