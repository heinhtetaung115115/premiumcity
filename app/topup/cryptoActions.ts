'use server';

import { requireAuth } from '@/lib/session';
import { getRateInfo } from '@/lib/cryptoRate';
import { createCryptoTopup, getEffectiveMinUsd, MAX_USD } from '@/lib/cryptoTopup';

export type CryptoQuote = {
  ok: boolean;
  error?: string;
  minUsd?: number;
  maxUsd?: number;
  rate?: number;
  marketRate?: number;
};

/** Live quote for the form: current rate + the real minimum. */
export async function getCryptoQuoteAction(): Promise<CryptoQuote> {
  await requireAuth();
  try {
    const [rateInfo, minUsd] = await Promise.all([getRateInfo(), getEffectiveMinUsd()]);
    return {
      ok: true,
      minUsd,
      maxUsd: MAX_USD,
      rate: rateInfo.effectiveRate,
      marketRate: rateInfo.marketRate,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Rate unavailable right now.' };
  }
}

export type CreateCryptoResult =
  | { ok: true; topupId: string }
  | { ok: false; error: string };

export async function createCryptoTopupAction(
  usdAmount: number
): Promise<CreateCryptoResult> {
  const session = await requireAuth();
  try {
    const row = await createCryptoTopup({
      userId: session.user.id as string,
      usdAmount,
    });
    return { ok: true, topupId: row.id };
  } catch (err: any) {
    console.error('[createCryptoTopupAction]', err);
    return { ok: false, error: err?.message || 'Could not create payment. Try again.' };
  }
}
