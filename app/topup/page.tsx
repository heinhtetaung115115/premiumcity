// app/topup/page.tsx
import { getServiceSupabaseClient } from '@/lib/supabase';
import { requireAuth } from '@/lib/session';
import BanksSelector from './BanksSelector';

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
  // 🔒 Must be logged in
  await requireAuth();

  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('bank_accounts')
    .select(
      'id,bank_name,account_name,account_no,qr_code_url,instructions,is_active'
    )
    .order('bank_name', { ascending: true });

  if (error) {
    throw error;
  }

  // Explicitly cast so TS knows it's an array, not unknown
  const rows = (data ?? []) as BankRow[];
  const banks = rows.filter((b) => b.is_active);

  // Read reason from query params, e.g. /topup?reason=insufficient_balance
  const reasonRaw = searchParams?.reason;
  const reason =
    typeof reasonRaw === 'string'
      ? reasonRaw
      : Array.isArray(reasonRaw)
      ? reasonRaw[0]
      : undefined;

  const fromInsufficientBalance = reason === 'insufficient_balance';

  return (
    <div className="space-y-6">
      {/* 🔔 Warning / info card when redirected from product purchase */}
      {fromInsufficientBalance && (
        <div className="rounded-xl border border-amber-500/60 bg-amber-950/50 px-4 py-3 text-sm text-amber-50">
          <p className="font-semibold">Not enough wallet balance</p>
          <p className="mt-1 text-amber-100/90">
            Your wallet balance is not sufficient to complete the purchase.
            Please top up your wallet and then try buying the product again.
          </p>
        </div>
      )}

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Top up wallet</h1>
        <p className="text-sm text-slate-400">
          Choose a payment method and submit your transaction details. We’ll
          verify and add funds shortly.
        </p>
      </header>

      {banks.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-300">
          No bank accounts configured yet. Please check back later.
        </div>
      ) : (
        <BanksSelector banks={banks} />
      )}
    </div>
  );
}
