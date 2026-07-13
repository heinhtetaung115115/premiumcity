'use server';

import { requireAuth } from '@/lib/session';
import {
  createCryptoTopup,
  getCryptoQuote,
  getPayOptions,
  MIN_USD,
  MAX_USD,
} from '@/lib/cryptoTopup';

export type CryptoQuote = {
  ok: boolean;
  rate?: number;
  minUsd?: number;
  maxUsd?: number;
  error?: string;
};

export async function getCryptoQuoteAction(): Promise<CryptoQuote> {
  await requireAuth();
  try {
    return await getCryptoQuote();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not load the rate.' };
  }
}

export type CoinChoice = {
  currency: string;
  network: string;
  minAmount: number;
  minUsd: number | null;
  commissionPercent: number;
  isStable: boolean;
};

export async function getCoinsAction(): Promise<{
  ok: boolean;
  coins?: CoinChoice[];
  error?: string;
}> {
  await requireAuth();
  try {
    const opts = await getPayOptions();
    return { ok: true, coins: opts };
  } catch (err: any) {
    console.error('[getCoinsAction]', err);
    return { ok: false, error: err?.message || 'Could not load coins.' };
  }
}

export type CreateCryptoResult = {
  ok: boolean;
  topupId?: string;
  error?: string;
};

export async function createCryptoTopupAction(
  usdAmount: number,
  currency: string,
  network: string
): Promise<CreateCryptoResult> {
  const session = await requireAuth();
  try {
    if (!Number.isFinite(usdAmount) || usdAmount < MIN_USD) {
      return { ok: false, error: `Minimum top-up is $${MIN_USD}.` };
    }
    if (usdAmount > MAX_USD) {
      return { ok: false, error: `Maximum top-up is $${MAX_USD}.` };
    }

    const row = await createCryptoTopup({
      userId: session.user.id as string,
      usdAmount,
      currency,
      network,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://pcitystore.com',
    });

    return { ok: true, topupId: row.id };
  } catch (err: any) {
    console.error('[createCryptoTopupAction]', err);
    return { ok: false, error: err?.message || 'Could not create payment.' };
  }
}
