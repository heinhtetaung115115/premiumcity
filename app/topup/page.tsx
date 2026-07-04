// app/topup/page.tsx
import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/session';
import { getWalletOverview } from '@/lib/wallet';
import TopupPageClient from './TopupPageClient';

export const dynamic = 'force-dynamic';

type BankRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no: string;
  qr_code_url: string | null;
  instructions: string | null;
  is_active: boolean;
};

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function TopupPage({ searchParams }: PageProps) {
  const session = await requireAuth();

  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id,bank_name,account_name,account_no,qr_code_url,instructions,is_active')
    .order('bank_name', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as BankRow[];
  const banks = rows.filter((b) => b.is_active);

  let balance = 0;
  try {
    const overview = await getWalletOverview(session.user.id as string);
    balance = overview.balance;
  } catch {
    balance = 0;
  }

  const reasonRaw = searchParams?.reason;
  const reason = typeof reasonRaw === 'string' ? reasonRaw : Array.isArray(reasonRaw) ? reasonRaw[0] : undefined;

  return <TopupPageClient banks={banks} reason={reason} balance={balance} />;
}
