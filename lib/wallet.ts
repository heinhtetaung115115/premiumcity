// lib/wallet.ts
import { getServiceSupabaseClient } from './supabase';
import {
  sendEmail,
  tplTopupSubmitted,
  tplTopupAdminNotify,
  tplTopupApproved,
  tplTopupRejected,
  getAdminRecipients
} from './email';

export type WalletTransaction = {
  id: string;
  amount: number;
  direction: 'IN' | 'OUT';
  type: 'CREDIT' | 'DEBIT';
  description: string | null;
  createdAt: string;
};

export type WalletOverview = {
  balance: number;
  walletTransactions: WalletTransaction[];
};

export type TopupRequest = {
  id: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  method: 'qr' | 'account';
  last4: string;
};

type SubmitTopupPayload = {
  userId: string;
  amount: number;

  bankName?: string;
  referenceHint?: string;
  note?: string | null;

  bankAccountId?: string | null;
  method?: 'qr' | 'account' | 'bank';
  last4?: string;
  accountNo?: string | null;
};

/**
 * Get wallet balance + recent transactions for a user.
 */
export async function getWalletOverview(userId: string): Promise<WalletOverview> {
  const supabase = getServiceSupabaseClient();

  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('id,balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (walletError) throw walletError;

  if (!wallet) {
    return {
      balance: 0,
      walletTransactions: []
    };
  }

  const walletId: string = (wallet as any).id;

  const { data: txRows, error: txError } = await supabase
    .from('wallet_transactions')
    .select('id,amount,direction,description,created_at')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (txError) throw txError;

  const walletTransactions: WalletTransaction[] = ((txRows ?? []) as any[]).map(
    (row) => {
      const rawDir = String(row.direction ?? '').toUpperCase();
      const isCredit = rawDir === 'CREDIT';

      return {
        id: row.id,
        amount: Number(row.amount),
        direction: isCredit ? 'IN' : 'OUT',
        type: isCredit ? 'CREDIT' : 'DEBIT',
        description: row.description ?? null,
        createdAt: row.created_at
      };
    }
  );

  return {
    balance: Number((wallet as any).balance ?? 0),
    walletTransactions
  };
}

/**
 * List recent top-up requests for the user.
 */
export async function listTopupRequests(userId: string): Promise<TopupRequest[]> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('topups')
    .select('id,amount,last4,status,created_at,method')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    amount: Number(row.amount),
    status: row.status,
    createdAt: row.created_at,
    method: row.method,
    last4: row.last4
  }));
}

/**
 * Submit a new top-up request (user submits form).
 */
export async function submitTopupRequest(payload: SubmitTopupPayload): Promise<void> {
  const supabase = getServiceSupabaseClient();

  // 1) User info
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id,email,name')
    .eq('id', payload.userId)
    .maybeSingle();

  if (userError) throw userError;

  const userEmail: string = (userRow as any)?.email ?? '';
  const userName: string = (userRow as any)?.name ?? '';

  // 2) Resolve bank account
  let bankAccount: any = null;

  if (payload.bankAccountId) {
    const { data: byId } = await supabase
      .from('bank_accounts')
      .select('id,bank_name,account_no,is_active')
      .eq('id', payload.bankAccountId)
      .maybeSingle();
    if (byId && (byId as any).is_active !== false) {
      bankAccount = byId;
    }
  }

  if (!bankAccount && payload.bankName) {
    const { data: byName } = await supabase
      .from('bank_accounts')
      .select('id,bank_name,account_no,is_active')
      .eq('bank_name', payload.bankName)
      .eq('is_active', true)
      .maybeSingle();
    if (byName) bankAccount = byName;
  }

  const bankAccountId: string | null = bankAccount?.id ?? null;
  const accountNo: string =
    payload.accountNo ?? bankAccount?.account_no ?? '';

  // 3) Method
  const method: 'qr' | 'account' =
    payload.method === 'qr' ? 'qr' : 'account';

  // 4) last4
  let last4 = (payload.last4 || '').replace(/\D/g, '');
  if (last4.length !== 4) {
    const source = payload.referenceHint || '';
    const digits = source.replace(/\D/g, '');
    last4 = digits.slice(-4) || '0000';
  }

  // 5) Insert into `topups`
  const { data: inserted, error: insertError } = await supabase
    .from('topups')
    .insert({
      user_id: payload.userId,
      bank_account_id: bankAccountId,
      amount: payload.amount,
      last4,
      status: 'PENDING',
      method
    })
    .select('id,last4')
    .maybeSingle();

  if (insertError) throw insertError;

  const topupId: string | null = (inserted as any)?.id ?? null;

  // 6) Email to user
  if (userEmail) {
    try {
      const { html, text } = tplTopupSubmitted(
        userName || userEmail,
        payload.amount,
        last4
      );
      await sendEmail({
        to: userEmail,
        subject: 'We received your top-up request',
        text,
        html
      });
    } catch (err) {
      console.error('Failed to send top-up confirmation email to user', err);
    }
  }

  // 7) Email to admins
  const admins = getAdminRecipients();
  if (admins.length > 0) {
    try {
      const { html, text } = tplTopupAdminNotify(
        userEmail || payload.userId,
        payload.amount,
        last4,
        topupId
      );
      await sendEmail({
        to: admins,
        subject: `New top-up submitted (${accountNo || 'no account'})`,
        text,
        html
      });
    } catch (err) {
      console.error('Failed to send top-up admin notification email', err);
    }
  }
}

/**
 * Approve a top-up:
 */
export async function approveTopup(topupId: string): Promise<void> {
  const supabase = getServiceSupabaseClient();

  // 1) Load topup
  const { data: topup, error: topupError } = await supabase
    .from('topups')
    .select('id,user_id,amount,status,last4')
    .eq('id', topupId)
    .maybeSingle();

  if (topupError) throw topupError;
  if (!topup) throw new Error('Top-up not found');

  const t = topup as any;

  if (t.status !== 'PENDING') {
    // already processed, do nothing
    return;
  }

  const userId = t.user_id as string;
  const amount = Number(t.amount);

  // 2) Ensure wallet
  const { data: walletRow, error: walletError } = await supabase
    .from('wallets')
    .select('id,balance')
    .eq('user_id', userId)
    .maybeSingle();

  if (walletError) throw walletError;

  let walletId: string;
  let currentBalance = 0;

  if (!walletRow) {
    const { data: newWallet, error: createWalletError } = await supabase
      .from('wallets')
      .insert({ user_id: userId, balance: amount })
      .select('id,balance')
      .maybeSingle();

    if (createWalletError) throw createWalletError;
    walletId = (newWallet as any).id;
    currentBalance = Number((newWallet as any).balance ?? amount);
  } else {
    walletId = (walletRow as any).id;
    currentBalance = Number((walletRow as any).balance ?? 0);

    const { error: updError } = await supabase
      .from('wallets')
      .update({ balance: currentBalance + amount })
      .eq('id', walletId);

    if (updError) throw updError;
    currentBalance = currentBalance + amount;
  }

  // 3) Insert wallet transaction – CREDIT
  const { error: txError } = await supabase.from('wallet_transactions').insert({
    wallet_id: walletId,
    amount,
    direction: 'CREDIT',
    description: 'Top-up approved'
  });

  if (txError) throw txError;

  // 4) Mark topup as APPROVED
  const { error: statusError } = await supabase
    .from('topups')
    .update({ status: 'APPROVED' })
    .eq('id', topupId);

  if (statusError) throw statusError;

  // 5) Email to user
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('email,name')
    .eq('id', userId)
    .maybeSingle();

  if (userError) throw userError;

  const userEmail: string = (userRow as any)?.email ?? '';
  const userName: string = (userRow as any)?.name ?? '';

  if (userEmail) {
    try {
      const { html, text } = tplTopupApproved(
        userName || userEmail,
        amount,
        currentBalance
      );
      await sendEmail({
        to: userEmail,
        subject: 'Your top-up was approved',
        text,
        html
      });
    } catch (err) {
      console.error('Failed to send top-up approved email', err);
    }
  }
}

/**
 * Reject a top-up:
 */
export async function rejectTopup(
  topupId: string,
  reason?: string
): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { data: topup, error: topupError } = await supabase
    .from('topups')
    .select('id,user_id,amount,status')
    .eq('id', topupId)
    .maybeSingle();

  if (topupError) throw topupError;
  if (!topup) throw new Error('Top-up not found');

  const t = topup as any;

  if (t.status !== 'PENDING') {
    // already processed
    return;
  }

  const amount = Number(t.amount);
  const userId = t.user_id as string;

  // 1) Mark as REJECTED
  const { error: statusError } = await supabase
    .from('topups')
    .update({ status: 'REJECTED' })
    .eq('id', topupId);

  if (statusError) throw statusError;

  // 2) Email to user
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('email,name')
    .eq('id', userId)
    .maybeSingle();

  if (userError) throw userError;

  const userEmail: string = (userRow as any)?.email ?? '';
  const userName: string = (userRow as any)?.name ?? '';

  if (userEmail) {
    try {
      const { html, text } = tplTopupRejected(
        userName || userEmail,
        amount,
        reason
      );
      await sendEmail({
        to: userEmail,
        subject: 'Your top-up could not be approved',
        text,
        html
      });
    } catch (err) {
      console.error('Failed to send top-up rejected email', err);
    }
  }
}
