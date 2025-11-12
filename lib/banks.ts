import { getServiceSupabaseClient } from './supabase';

export async function listActiveBanks() {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('is_active', true)
    .order('bank_name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    bankName: row.bank_name as string,
    accountName: row.account_name as string,
    accountNo: row.account_no as string,
    instructions: (row.instructions as string | null) ?? null,
    qrCodeUrl: (row.qr_code_url as string | null) ?? null,
    isActive: row.is_active as boolean
  }));
}
