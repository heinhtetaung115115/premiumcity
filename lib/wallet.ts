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

export async function getWalletOverview(userId: string): Promise<WalletOverview> {
  const supabase = getServiceSupabaseClient();
  const { data: wallet, error: walletError } = await supabase
    .from('wallets').select('id,balance').eq('user_id', userId).maybeSingle();
  if (walletError) throw walletError;
  if (!wallet) return { balance: 0, walletTransactions: [] };
  const walletId: string = (wallet as any).id;
  const { data: txRows, error: txError } = await supabase
    .from('wallet_transactions').select('id,amount,direction,description,created_at')
    .eq('wallet_id', walletId).order('created_at', { ascending: false }).limit(25);
  if (txError) throw txError;
  const walletTransactions: WalletTransaction[] = ((txRows ?? []) as any[]).map((row) => {
    const rawDir = String(row.direction ?? '').toUpperCase();
    const isCredit = rawDir === 'CREDIT';
    return { id: row.id, amount: Number(row.amount), direction: isCredit ? 'IN' : 'OUT', type: isCredit ? 'CREDIT' : 'DEBIT', description: row.description ?? null, createdAt: row.created_at };
  });
  return { balance: Number((wallet as any).balance ?? 0), walletTransactions };
}

export type PendingTopupAdminView = {
  id: string;
  userId: string;
  userEmail: string | null;
  amount: number;
  method: 'qr' | 'account';
  last4: string;
  createdAt: string;
  bankName: string | null;
  accountNo: string | null;
};

/**
 * Admin dashboard: top-ups awaiting manual review, newest-need-attention
 * (oldest) first.
 */
export async function listPendingTopupsForAdmin(limit = 50): Promise<PendingTopupAdminView[]> {
  const supabase = getServiceSupabaseClient();

  const { data: topupRows, error } = await supabase
    .from('topups')
    .select('id,user_id,bank_account_id,amount,last4,method,status,created_at')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;

  const topups = (topupRows ?? []) as any[];
  if (topups.length === 0) return [];

  const userIds = Array.from(new Set(topups.map((t) => t.user_id)));
  const bankIds = Array.from(new Set(topups.map((t) => t.bank_account_id).filter(Boolean)));

  const [{ data: userRows, error: userError }, bankRes] = await Promise.all([
    supabase.from('users').select('id,email').in('id', userIds),
    bankIds.length > 0
      ? supabase.from('bank_accounts').select('id,bank_name,account_no').in('id', bankIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (userError) throw userError;
  if ((bankRes as any).error) throw (bankRes as any).error;

  const userById: Record<string, any> = {};
  for (const u of (userRows ?? []) as any[]) userById[u.id] = u;
  const bankById: Record<string, any> = {};
  for (const b of ((bankRes as any).data ?? []) as any[]) bankById[b.id] = b;

  return topups.map((t) => ({
    id: t.id,
    userId: t.user_id,
    userEmail: userById[t.user_id]?.email ?? null,
    amount: Number(t.amount),
    method: t.method,
    last4: t.last4,
    createdAt: t.created_at,
    bankName: bankById[t.bank_account_id]?.bank_name ?? null,
    accountNo: bankById[t.bank_account_id]?.account_no ?? null,
  }));
}

export async function listTopupRequests(userId: string): Promise<TopupRequest[]> {
  const supabase = getServiceSupabaseClient();
  const { data, error } = await supabase.from('topups').select('id,amount,last4,status,created_at,method')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return ((data ?? []) as any[]).map((row) => ({
    id: row.id, amount: Number(row.amount), status: row.status, createdAt: row.created_at, method: row.method, last4: row.last4
  }));
}

export async function submitTopupRequest(payload: SubmitTopupPayload): Promise<void> {
  const supabase = getServiceSupabaseClient();
  const { data: userRow, error: userError } = await supabase.from('users').select('id,email,name').eq('id', payload.userId).maybeSingle();
  if (userError) throw userError;
  const userEmail: string = (userRow as any)?.email ?? '';
  const userName: string = (userRow as any)?.name ?? '';

  let bankAccount: any = null;
  if (payload.bankAccountId) {
    const { data: byId } = await supabase.from('bank_accounts').select('id,bank_name,account_no,is_active').eq('id', payload.bankAccountId).maybeSingle();
    if (byId && (byId as any).is_active !== false) bankAccount = byId;
  }
  if (!bankAccount && payload.bankName) {
    const { data: byName } = await supabase.from('bank_accounts').select('id,bank_name,account_no,is_active').eq('bank_name', payload.bankName).eq('is_active', true).maybeSingle();
    if (byName) bankAccount = byName;
  }
  const bankAccountId: string | null = bankAccount?.id ?? null;
  const accountNo: string = payload.accountNo ?? bankAccount?.account_no ?? '';
  const method: 'qr' | 'account' = payload.method === 'qr' ? 'qr' : 'account';

  let last4 = (payload.last4 || '').replace(/\D/g, '');
  if (last4.length !== 4) {
    const source = payload.referenceHint || '';
    const digits = source.replace(/\D/g, '');
    last4 = digits.slice(-4) || '0000';
  }

  const { data: inserted, error: insertError } = await supabase.from('topups').insert({
    user_id: payload.userId, bank_account_id: bankAccountId, amount: payload.amount, last4, status: 'PENDING', method
  }).select('id,last4').maybeSingle();
  if (insertError) throw insertError;
  const topupId: string | null = (inserted as any)?.id ?? null;

  if (userEmail) {
    try {
      const { html, text } = tplTopupSubmitted(userName || userEmail, payload.amount, last4);
      await sendEmail({ to: userEmail, subject: 'We received your top-up request', text, html });
    } catch (err) { console.error('Failed to send top-up confirmation email to user', err); }
  }

  const admins = getAdminRecipients();
  if (admins.length > 0) {
    try {
      const { html, text } = tplTopupAdminNotify(userEmail || payload.userId, payload.amount, last4, topupId);
      await sendEmail({ to: admins, subject: `New top-up submitted (${accountNo || 'no account'})`, text, html });
    } catch (err) { console.error('Failed to send top-up admin notification email', err); }
  }
}

export class TopupAlreadyProcessedError extends Error {
  constructor() {
    super('This top-up has already been processed.');
    this.name = 'TopupAlreadyProcessedError';
  }
}

/**
 * Approve a top-up.
 *
 * Race-safety: the topup is "claimed" first via a conditional UPDATE that
 * only succeeds `WHERE status = 'PENDING'`. Postgres evaluates that
 * check-and-write as a single atomic statement, so if two approval requests
 * land at the same time (double click, or the admin UI and the KBZ
 * auto-verify path both firing), only one of them can win the claim — the
 * other gets 0 rows back and bails out via TopupAlreadyProcessedError
 * *before* touching the wallet balance. This prevents double-crediting.
 *
 * @param skipEmail - if true, skip sending approval email (used by KBZ auto-verify)
 */
export async function approveTopup(topupId: string, skipEmail = false): Promise<void> {
  const supabase = getServiceSupabaseClient();

  // 1) Atomically claim this topup. Only one concurrent caller can win.
  const { data: claimed, error: claimError } = await supabase
    .from('topups')
    .update({ status: 'APPROVED' })
    .eq('id', topupId)
    .eq('status', 'PENDING')
    .select('id,user_id,amount,last4')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) {
    // Either the topup doesn't exist, or someone else already processed it.
    throw new TopupAlreadyProcessedError();
  }

  const t = claimed as any;
  const userId = t.user_id as string;
  const amount = Number(t.amount);

  try {
    const { data: walletRow, error: walletError } = await supabase
      .from('wallets').select('id,balance').eq('user_id', userId).maybeSingle();
    if (walletError) throw walletError;

    let walletId: string;
    let currentBalance = 0;

    if (!walletRow) {
      const { data: newWallet, error: createWalletError } = await supabase
        .from('wallets').insert({ user_id: userId, balance: amount }).select('id,balance').maybeSingle();
      if (createWalletError) throw createWalletError;
      walletId = (newWallet as any).id;
      currentBalance = Number((newWallet as any).balance ?? amount);
    } else {
      walletId = (walletRow as any).id;
      currentBalance = Number((walletRow as any).balance ?? 0);
      const { error: updError } = await supabase.from('wallets').update({ balance: currentBalance + amount }).eq('id', walletId);
      if (updError) throw updError;
      currentBalance = currentBalance + amount;
    }

    const { error: txError } = await supabase.from('wallet_transactions').insert({
      wallet_id: walletId, amount, direction: 'CREDIT', description: 'Top-up approved'
    });
    if (txError) throw txError;
  } catch (err) {
    // The topup is already marked APPROVED but we failed to credit the
    // wallet — revert the claim so the top-up goes back to PENDING and can
    // be retried, instead of silently leaving the user uncredited.
    console.error('approveTopup: crediting wallet failed, reverting status to PENDING', err);
    await supabase.from('topups').update({ status: 'PENDING' }).eq('id', topupId).eq('status', 'APPROVED');
    throw err;
  }

  // Email to user — skip for KBZ auto-verify
  if (!skipEmail) {
    const { data: userRow, error: userError } = await supabase
      .from('users').select('email,name').eq('id', userId).maybeSingle();
    if (userError) throw userError;
    const userEmail: string = (userRow as any)?.email ?? '';
    const userName: string = (userRow as any)?.name ?? '';
    if (userEmail) {
      try {
        const { html, text } = tplTopupApproved(userName || userEmail, amount);
        await sendEmail({ to: userEmail, subject: 'Your top-up was approved', text, html });
      } catch (err) { console.error('Failed to send top-up approved email', err); }
    }
  }
}

/**
 * Reject a top-up.
 *
 * Uses the same atomic conditional-update claim as approveTopup, so a
 * reject racing an approve (or two rejects racing each other) can only
 * apply once.
 *
 * @param skipEmail - if true, skip sending rejection email (used by KBZ auto-verify)
 */
export async function rejectTopup(topupId: string, reason?: string, skipEmail = false): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const { data: claimed, error: claimError } = await supabase
    .from('topups')
    .update({ status: 'REJECTED' })
    .eq('id', topupId)
    .eq('status', 'PENDING')
    .select('id,user_id,amount')
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claimed) {
    throw new TopupAlreadyProcessedError();
  }

  const t = claimed as any;
  const amount = Number(t.amount);
  const userId = t.user_id as string;

  // Email to user — skip for KBZ auto-verify
  if (!skipEmail) {
    const { data: userRow, error: userError } = await supabase
      .from('users').select('email,name').eq('id', userId).maybeSingle();
    if (userError) throw userError;
    const userEmail: string = (userRow as any)?.email ?? '';
    const userName: string = (userRow as any)?.name ?? '';
    if (userEmail) {
      try {
        const { html, text } = tplTopupRejected(userName || userEmail, amount, reason);
        await sendEmail({ to: userEmail, subject: 'Your top-up could not be approved', text, html });
      } catch (err) { console.error('Failed to send top-up rejected email', err); }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// WALLET PAGE — balance + full top-up and spending history
// ─────────────────────────────────────────────────────────────
//
// Top-ups come from TWO places, so we merge them:
//   • topup_requests  — manual bank/KBZ transfers (can be PENDING)
//   • crypto_topups   — Heleket payments (auto-credited)
// Spending is read from wallet_transactions DEBIT rows, which is the ledger
// every purchase and renewal writes to.

export type WalletTopupEntry = {
  id: string;
  amount: number; // MMK
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CREDITED' | 'FAILED';
  source: 'MANUAL' | 'CRYPTO';
  detail: string | null; // e.g. "USDT · tron" or the bank last4
  createdAt: string;
};

export type WalletSpendEntry = {
  id: string;
  amount: number; // MMK
  description: string | null;
  createdAt: string;
};

export type WalletPageData = {
  balance: number;
  topups: WalletTopupEntry[];
  spending: WalletSpendEntry[];
  totalToppedUp: number; // credited only
  totalSpent: number;
};

export async function getWalletPageData(userId: string): Promise<WalletPageData> {
  const supabase = getServiceSupabaseClient();

  // Balance + wallet id
  let balance = 0;
  let walletId: string | null = null;
  try {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id,balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (wallet) {
      walletId = (wallet as any).id;
      balance = Number((wallet as any).balance ?? 0);
    }
  } catch {
    /* keep defaults */
  }

  // ── Manual top-up requests (table is `topups`) ──
  const topups: WalletTopupEntry[] = [];
  try {
    const { data: rows } = await supabase
      .from('topups')
      .select('id,amount,status,created_at,last4,method')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    for (const r of ((rows ?? []) as any[])) {
      const method = r.method ? String(r.method) : null;
      const last4 = r.last4 ? `••${r.last4}` : null;
      topups.push({
        id: String(r.id),
        amount: Number(r.amount ?? 0),
        status: (String(r.status ?? 'PENDING').toUpperCase() as any) ?? 'PENDING',
        source: 'MANUAL',
        detail: [method, last4].filter(Boolean).join(' ') || null,
        createdAt: r.created_at,
      });
    }
  } catch {
    /* table shape differences shouldn't break the page */
  }

  // ── Crypto top-ups ──
  try {
    const { data: rows } = await supabase
      .from('crypto_topups')
      .select('id,mmk_amount,usd_amount,pay_currency,network,status,credited,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    for (const r of ((rows ?? []) as any[])) {
      // Only show crypto attempts that actually went somewhere — a customer
      // who opened the page and never paid shouldn't see clutter.
      const credited = !!r.credited;
      const status = String(r.status ?? '').toUpperCase();
      if (!credited && !['FAILED', 'CANCEL', 'EXPIRED'].includes(status)) {
        // still waiting / never paid — skip unless it was credited
        if (status !== 'PAID' && status !== 'PAID_OVER') continue;
      }
      const coin = r.pay_currency ? String(r.pay_currency) : null;
      const net = r.network ? String(r.network) : null;
      topups.push({
        id: String(r.id),
        amount: Number(r.mmk_amount ?? 0),
        status: credited ? 'CREDITED' : 'FAILED',
        source: 'CRYPTO',
        detail: [coin, net].filter(Boolean).join(' · ') || null,
        createdAt: r.created_at,
      });
    }
  } catch {
    /* crypto table may not exist in older deployments */
  }

  topups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ── Spending (DEBIT ledger rows) ──
  const spending: WalletSpendEntry[] = [];
  if (walletId) {
    try {
      const { data: rows } = await supabase
        .from('wallet_transactions')
        .select('id,amount,direction,description,created_at')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(200);
      for (const r of ((rows ?? []) as any[])) {
        if (String(r.direction ?? '').toUpperCase() !== 'DEBIT') continue;
        spending.push({
          id: String(r.id),
          amount: Number(r.amount ?? 0),
          description: r.description ?? null,
          createdAt: r.created_at,
        });
      }
    } catch {
      /* keep empty */
    }
  }

  const totalToppedUp = topups
    .filter((t) => t.status === 'APPROVED' || t.status === 'CREDITED')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = spending.reduce((sum, s) => sum + s.amount, 0);

  return { balance, topups, spending, totalToppedUp, totalSpent };
}
