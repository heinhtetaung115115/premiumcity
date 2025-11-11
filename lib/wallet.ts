import { getServiceSupabaseClient } from './supabase';
import { sendMail } from './mailer';
import type { WalletTransaction } from '@/types/entities';

type TopupPayload = {
  userId: string;
  amount: number;
  bankName: string;
  referenceHint: string;
  note?: string;
};

type WalletTransactionRow = {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function submitTopupRequest(payload: TopupPayload) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('topup_requests')
    .insert({
      user_id: payload.userId,
      amount: payload.amount,
      bank_name: payload.bankName,
      reference_hint: payload.referenceHint,
      metadata: payload.note ? { note: payload.note } : null
    })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const adminEmail = process.env.ADMIN_ALERT_EMAIL;
  if (adminEmail) {
    await sendMail({
      to: adminEmail,
      subject: 'New wallet top-up pending review',
      html: `Customer ${payload.userId} submitted a top-up of ${payload.amount} via ${payload.bankName}.<br/>Reference hint: ${payload.referenceHint}<br/>Note: ${payload.note ?? 'n/a'}<br/><a href="${process.env.NEXTAUTH_URL}/admin/topups/${data.id}">Review request</a>`
    });
  }

  return data;
}

export async function getWalletOverview(userId: string) {
  const supabase = getServiceSupabaseClient();
  const [{ data: user, error: userError }, { data: transactions, error: transactionsError }] = await Promise.all([
    supabase
      .from('users')
      .select('id, wallet_balance')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25)
  ]);

  if (userError) {
    throw userError;
  }

  if (transactionsError) {
    throw transactionsError;
  }

  return {
    id: user?.id ?? userId,
    walletBalance: Number(user?.wallet_balance ?? 0),
    walletTransactions: (transactions as WalletTransactionRow[]).map((transaction) => ({
      id: transaction.id,
      type: transaction.type as WalletTransaction['type'],
      amount: Number(transaction.amount),
      balanceAfter: Number(transaction.balance_after),
      reference: transaction.reference,
      metadata: transaction.metadata,
      createdAt: transaction.created_at
    }))
  };
}

export async function listTopupRequests(userId: string) {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('topup_requests')
    .select('id, user_id, amount, bank_name, reference_hint, status, metadata, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    amount: Number(row.amount),
    userId: row.user_id as string,
    bankName: row.bank_name as string,
    referenceHint: row.reference_hint as string,
    status: row.status as string,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }));
}

export async function listPendingTopups() {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase
    .from('topup_requests')
    .select(
      'id, user_id, amount, bank_name, reference_hint, status, admin_comment, metadata, created_at, updated_at, user:users(id, email, name)'
    )
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    amount: Number(row.amount),
    bankName: row.bank_name as string,
    referenceHint: row.reference_hint as string,
    status: row.status as string,
    adminComment: (row.admin_comment as string | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    user: row.user as { id: string; email: string | null; name: string | null }
  }));
}
