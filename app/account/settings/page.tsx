import { requireAuth } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { SettingsClient } from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const supabase = getServiceSupabaseClient();
  const { data: userRow } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();

  const email = (userRow as any)?.email ?? '';

  return <SettingsClient email={email} />;
}
