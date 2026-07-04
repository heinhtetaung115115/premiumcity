import { requireAuth } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { getWalletOverview } from '@/lib/wallet';
import { AccountClient } from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const supabase = getServiceSupabaseClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('email,name,avatar_url,created_at')
    .eq('id', userId)
    .maybeSingle();

  const u = (userRow as any) ?? {};

  let balance = 0;
  try {
    const overview = await getWalletOverview(userId);
    balance = overview.balance;
  } catch {
    balance = 0;
  }

  return (
    <AccountClient
      email={u.email ?? ''}
      name={u.name ?? ''}
      avatarUrl={u.avatar_url ?? null}
      createdAt={u.created_at ?? null}
      balance={balance}
    />
  );
}
