import { getAllProducts } from '@/lib/catalog';
import { getOptionalSession } from '@/lib/session';
import { getWalletOverview } from '@/lib/wallet';
import { HomeClient } from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { categories, products } = await getAllProducts();

  // Optional: if logged in, show the wallet balance card
  let walletBalance: number | null = null;
  let userName: string | null = null;

  try {
    const session = await getOptionalSession();
    const userId = (session?.user as any)?.id;
    if (userId) {
      userName = (session?.user as any)?.name || (session?.user as any)?.email?.split('@')[0] || null;
      const overview = await getWalletOverview(userId);
      walletBalance = overview.balance;
    }
  } catch {
    // If anything fails, just hide the balance card — products still render
    walletBalance = null;
  }

  return (
    <HomeClient
      categories={categories}
      products={products}
      walletBalance={walletBalance}
      userName={userName}
    />
  );
}
