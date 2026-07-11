// app/topup/crypto/[id]/page.tsx
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/session';
import { getCryptoTopupById } from '@/lib/cryptoTopup';
import CryptoPaymentClient from './CryptoPaymentClient';

export const dynamic = 'force-dynamic';

export default async function CryptoPaymentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAuth();
  const topup = await getCryptoTopupById(params.id, session.user.id as string);
  if (!topup) notFound();

  return (
    <CryptoPaymentClient
      topupId={topup.id}
      payAddress={topup.pay_address ?? ''}
      payAmount={Number(topup.pay_amount ?? 0)}
      usdAmount={Number(topup.usd_amount)}
      mmkAmount={Number(topup.mmk_amount)}
      rate={Number(topup.rate)}
      status={topup.status}
      credited={topup.credited}
      expiresAt={topup.expires_at}
    />
  );
}
