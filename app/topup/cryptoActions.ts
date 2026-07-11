'use server';

import { requireAuth } from '@/lib/session';
import { getRateInfo } from '@/lib/cryptoRate';
import { createCryptoTopup, getEffectiveMinUsd, MAX_USD } from '@/lib/cryptoTopup';
import { getNetworkOptions, PAY_CURRENCY } from '@/lib/nowpayments';

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

export type NetworkChoice = {
  code: string;
  label: string;
  network: string;
  note: string;
  minUsd: number | null;
  available: boolean;
};

/** Live list of networks with each one's REAL minimum from NOWPayments. */
export async function getNetworksAction(): Promise<{
  ok: boolean;
  networks?: NetworkChoice[];
  error?: string;
}> {
  await requireAuth();
  try {
    const opts = await getNetworkOptions();
    return { ok: true, networks: opts };
  } catch (err: any) {
    console.error('[getNetworksAction]', err);
    return { ok: false, error: err?.message || 'Could not load networks.' };
  }
}

export type CreateCryptoResult = {
  ok: boolean;
  topupId?: string;
  error?: string;
};

export async function createCryptoTopupAction(
  usdAmount: number,
  payCurrency?: string
): Promise<CreateCryptoResult> {
  const session = await requireAuth();
  try {
    const row = await createCryptoTopup({
      userId: session.user.id as string,
      usdAmount,
      payCurrency: payCurrency || PAY_CURRENCY,
    });
    return { ok: true, topupId: row.id };
  } catch (err: any) {
    console.error('[createCryptoTopupAction]', err);
    return { ok: false, error: err?.message || 'Could not create payment. Try again.' };
  }
}
