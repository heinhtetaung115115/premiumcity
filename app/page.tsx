import { getAllProducts } from '@/lib/catalog';
import { getOptionalSession } from '@/lib/session';
import { getWalletOverview } from '@/lib/wallet';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { HomeClient } from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { categories, products } = await getAllProducts();

  let walletBalance: number | null = null;
  let userName: string | null = null;
  let avatarUrl: string | null = null;

  try {
    const session = await getOptionalSession();
    const userId = (session?.user as any)?.id;
    if (userId) {
      // Read fresh name + avatar from the DATABASE (not the stale JWT token)
      const supabase = getServiceSupabaseClient();
      const { data: userRow } = await supabase
        .from('users')
        .select('name,email,avatar_url')
        .eq('id', userId)
        .maybeSingle();

      const u = (userRow as any) ?? {};
      userName = u.name || u.email?.split('@')[0] || null;
      avatarUrl = u.avatar_url ?? null;

      const overview = await getWalletOverview(userId);
      walletBalance = overview.balance;
    }
  } catch {
    walletBalance = null;
  }

  return (
    <HomeClient
      categories={categories}
      products={products}
      walletBalance={walletBalance}
      userName={userName}
      avatarUrl={avatarUrl}
    />
  );
}
