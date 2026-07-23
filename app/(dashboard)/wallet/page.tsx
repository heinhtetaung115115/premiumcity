import { requireAuth } from '@/lib/session';
import { getWalletPageData } from '@/lib/wallet';
import WalletClient from './WalletClient';

export const dynamic = 'force-dynamic';

export default async function WalletPage() {
  const session = await requireAuth();
  const data = await getWalletPageData(session.user.id!);

  return (
    <WalletClient
      balance={data.balance}
      topups={data.topups}
      spending={data.spending}
      totalToppedUp={data.totalToppedUp}
      totalSpent={data.totalSpent}
    />
  );
}
