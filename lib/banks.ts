import { getServiceSupabaseClient } from './supabase';

type BankRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no: string;
  instructions: string | null;
  qr_code_url: string | null;
  is_active: boolean;
};

export async function listActiveBanks() {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('bank_accounts')
    .select(
      'id,bank_name,account_name,account_no,instructions,qr_code_url,is_active'
    )
    .eq('is_active', true)
    .order('bank_name', { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as BankRow[];

  return rows.map((row) => ({
    id: row.id,
    bankName: row.bank_name,
    accountName: row.account_name,
    accountNo: row.account_no,
    instructions: row.instructions ?? null,
    qrCodeUrl: row.qr_code_url ?? null,
    isActive: row.is_active,
  }));
}
