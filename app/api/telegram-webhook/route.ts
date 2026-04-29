// app/api/telegram-webhook/route.ts
// Handles Telegram updates — dashboard buttons, top-up approve/reject with emails

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import {
  answerCallbackQuery,
  editMessageText,
  sendTelegramMessage,
  getDashboardButtons,
  getDashboardText,
} from '@/lib/telegram';
import {
  sendEmail,
  tplTopupApproved,
  tplTopupRejected,
} from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const SITE_URL = process.env.NEXTAUTH_URL || 'https://premiumcity.vercel.app';

export async function POST(req: Request) {
  // Verify webhook secret
  if (WEBHOOK_SECRET) {
    const token = req.headers.get('x-telegram-bot-api-secret-token') || '';
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // ─── Handle callback queries (button presses) ──
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return NextResponse.json({ ok: true });
    }

    // ─── Handle any text message → show dashboard ──
    if (update.message) {
      const chatId = update.message.chat?.id;

      if (String(chatId) !== String(ADMIN_CHAT_ID)) {
        return NextResponse.json({ ok: true });
      }

      // Any message from admin → send dashboard with live stats
      const stats = await getPendingStats();
      await sendTelegramMessage({
        text: getDashboardText(stats),
        buttons: getDashboardButtons(),
      });

      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error('[telegram-webhook] error:', err);
  }

  return NextResponse.json({ ok: true });
}

// ─── Get pending counts ─────────────────────────────────

async function getPendingStats() {
  const supabase = getServiceSupabaseClient();

  const [topupsRes, ordersRes] = await Promise.all([
    supabase.from('topups').select('id').eq('status', 'PENDING'),
    supabase.from('orders').select('id').eq('status', 'PENDING_FULFILLMENT'),
  ]);

  return {
    pendingTopups: ((topupsRes.data ?? []) as any[]).length,
    pendingOrders: ((ordersRes.data ?? []) as any[]).length,
  };
}

// ─── Handle all button presses ──────────────────────────

async function handleCallback(cb: any) {
  const data: string = cb.data || '';
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;

  if (String(chatId) !== String(ADMIN_CHAT_ID)) {
    await answerCallbackQuery(cb.id, '⛔ Unauthorized');
    return;
  }

  // ── Dashboard menu buttons ──
  if (data === 'menu:status' || data === 'menu:refresh') {
    const stats = await getPendingStats();
    await editMessageText(
      chatId,
      messageId,
      getDashboardText(stats),
      'HTML',
      getDashboardButtons()
    );
    await answerCallbackQuery(cb.id, '✅ Updated');
    return;
  }

  if (data === 'menu:topups') {
    const supabase = getServiceSupabaseClient();
    const { data: topups } = await supabase
      .from('topups')
      .select('id,amount,last4,status,created_at,method')
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(10);

    const rows = (topups ?? []) as any[];

    if (rows.length === 0) {
      await answerCallbackQuery(cb.id, '✅ No pending top-ups!');
      await editMessageText(
        chatId,
        messageId,
        '✅ <b>No pending top-ups!</b>\n\nAll top-ups have been processed.',
        'HTML',
        [[{ text: '◀️ Back to Dashboard', callback_data: 'menu:status' }]]
      );
      return;
    }

    const lines = rows.map((t: any, i: number) => {
      const amt = Number(t.amount).toLocaleString();
      return `${i + 1}. <b>${amt} MMK</b> · Last4: ${t.last4} · ${t.method || 'account'}`;
    });

    await editMessageText(
      chatId,
      messageId,
      [
        `💰 <b>Pending Top-ups (${rows.length})</b>`,
        '',
        ...lines,
        '',
        '⬇️ Tap Approve/Reject on the original notification messages,',
        `or go to the <a href="${SITE_URL}/admin/topups">Admin Panel</a>.`,
      ].join('\n'),
      'HTML',
      [[{ text: '◀️ Back to Dashboard', callback_data: 'menu:status' }]]
    );
    await answerCallbackQuery(cb.id);
    return;
  }

  if (data === 'menu:orders') {
    const supabase = getServiceSupabaseClient();
    const { data: orders } = await supabase
      .from('orders')
      .select('id,total_amount,status,created_at')
      .eq('status', 'PENDING_FULFILLMENT')
      .order('created_at', { ascending: false })
      .limit(10);

    const rows = (orders ?? []) as any[];

    if (rows.length === 0) {
      await answerCallbackQuery(cb.id, '✅ No pending orders!');
      await editMessageText(
        chatId,
        messageId,
        '✅ <b>No pending manual orders!</b>\n\nAll orders have been fulfilled.',
        'HTML',
        [[{ text: '◀️ Back to Dashboard', callback_data: 'menu:status' }]]
      );
      return;
    }

    const lines = rows.map((o: any, i: number) => {
      const amt = Number(o.total_amount).toLocaleString();
      const date = new Date(o.created_at).toLocaleString('en-US', {
        timeZone: 'Asia/Yangon',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${i + 1}. <b>${amt} MMK</b> · ${date}`;
    });

    await editMessageText(
      chatId,
      messageId,
      [
        `📦 <b>Pending Manual Orders (${rows.length})</b>`,
        '',
        ...lines,
        '',
        `👉 <a href="${SITE_URL}/admin/orders">Fulfill in Admin Panel</a>`,
      ].join('\n'),
      'HTML',
      [[{ text: '◀️ Back to Dashboard', callback_data: 'menu:status' }]]
    );
    await answerCallbackQuery(cb.id);
    return;
  }

  // ── Top-up approve/reject buttons ──
  if (data.startsWith('approve_topup:')) {
    const topupId = data.replace('approve_topup:', '');
    await handleApproveTopup(topupId, cb.id, chatId, messageId);
    return;
  }

  if (data.startsWith('reject_topup:')) {
    const topupId = data.replace('reject_topup:', '');
    await handleRejectTopup(topupId, cb.id, chatId, messageId);
    return;
  }

  await answerCallbackQuery(cb.id, 'Unknown action');
}

// ─── Approve top-up + send email ────────────────────────

async function handleApproveTopup(
  topupId: string,
  callbackQueryId: string,
  chatId: number,
  messageId: number
) {
  const supabase = getServiceSupabaseClient();

  try {
    const { data: topup, error: fetchErr } = await supabase
      .from('topups')
      .select('id,user_id,amount,status,last4')
      .eq('id', topupId)
      .maybeSingle();

    if (fetchErr || !topup) {
      await answerCallbackQuery(callbackQueryId, '❌ Top-up not found');
      return;
    }

    const t = topup as any;

    if (t.status !== 'PENDING') {
      await answerCallbackQuery(callbackQueryId, `Already ${t.status.toLowerCase()}`);
      await editMessageText(
        chatId,
        messageId,
        `✅ This top-up was already <b>${(t.status as string).toLowerCase()}</b>.`
      );
      return;
    }

    const userId = t.user_id as string;
    const amount = Number(t.amount);

    // Credit wallet
    const { data: walletRow } = await supabase
      .from('wallets')
      .select('id,balance')
      .eq('user_id', userId)
      .maybeSingle();

    let walletId: string;
    let newBalance: number;

    if (!walletRow) {
      const { data: newWallet, error: createErr } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: amount })
        .select('id,balance')
        .maybeSingle();

      if (createErr) throw createErr;
      walletId = (newWallet as any).id;
      newBalance = amount;
    } else {
      walletId = (walletRow as any).id;
      const currentBalance = Number((walletRow as any).balance ?? 0);
      newBalance = currentBalance + amount;

      const { error: updErr } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', walletId);

      if (updErr) throw updErr;
    }

    // Record wallet transaction
    await supabase.from('wallet_transactions').insert({
      wallet_id: walletId,
      amount,
      direction: 'CREDIT',
      description: 'Top-up approved',
    });

    // Mark topup as APPROVED
    await supabase
      .from('topups')
      .update({ status: 'APPROVED' })
      .eq('id', topupId);

    // ── Send approval email to customer ──
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('email,name')
        .eq('id', userId)
        .maybeSingle();

      const userEmail: string = (userRow as any)?.email ?? '';
      const userName: string = (userRow as any)?.name ?? '';

      if (userEmail) {
        const { html, text } = tplTopupApproved(
          userName || userEmail,
          amount,
          newBalance
        );
        await sendEmail({
          to: userEmail,
          subject: 'Your top-up was approved',
          text,
          html,
        });
      }
    } catch (emailErr) {
      console.error('[telegram] Failed to send approval email:', emailErr);
    }

    await answerCallbackQuery(callbackQueryId, '✅ Approved!');
    await editMessageText(
      chatId,
      messageId,
      [
        '✅ <b>Top-Up Approved</b>',
        '',
        `💵 Amount: ${amount.toLocaleString()} MMK`,
        `💳 New balance: ${newBalance.toLocaleString()} MMK`,
        `🔢 Last 4: ${t.last4}`,
        `📧 Email sent to customer`,
      ].join('\n')
    );
  } catch (err: any) {
    console.error('[telegram] approve topup error:', err);
    await answerCallbackQuery(
      callbackQueryId,
      `❌ Error: ${err?.message ?? 'Unknown'}`
    );
  }
}

// ─── Reject top-up + send email ─────────────────────────

async function handleRejectTopup(
  topupId: string,
  callbackQueryId: string,
  chatId: number,
  messageId: number
) {
  const supabase = getServiceSupabaseClient();

  try {
    const { data: topup, error: fetchErr } = await supabase
      .from('topups')
      .select('id,user_id,status,amount,last4')
      .eq('id', topupId)
      .maybeSingle();

    if (fetchErr || !topup) {
      await answerCallbackQuery(callbackQueryId, '❌ Top-up not found');
      return;
    }

    const t = topup as any;

    if (t.status !== 'PENDING') {
      await answerCallbackQuery(callbackQueryId, `Already ${t.status.toLowerCase()}`);
      await editMessageText(
        chatId,
        messageId,
        `This top-up was already <b>${(t.status as string).toLowerCase()}</b>.`
      );
      return;
    }

    // Mark as REJECTED
    await supabase
      .from('topups')
      .update({ status: 'REJECTED' })
      .eq('id', topupId);

    // ── Send rejection email to customer ──
    try {
      const userId = t.user_id as string;
      const { data: userRow } = await supabase
        .from('users')
        .select('email,name')
        .eq('id', userId)
        .maybeSingle();

      const userEmail: string = (userRow as any)?.email ?? '';
      const userName: string = (userRow as any)?.name ?? '';

      if (userEmail) {
        const { html, text } = tplTopupRejected(
          userName || userEmail,
          Number(t.amount)
        );
        await sendEmail({
          to: userEmail,
          subject: 'Your top-up could not be approved',
          text,
          html,
        });
      }
    } catch (emailErr) {
      console.error('[telegram] Failed to send rejection email:', emailErr);
    }

    await answerCallbackQuery(callbackQueryId, '❌ Rejected');
    await editMessageText(
      chatId,
      messageId,
      [
        '❌ <b>Top-Up Rejected</b>',
        '',
        `💵 Amount: ${Number(t.amount).toLocaleString()} MMK`,
        `🔢 Last 4: ${t.last4}`,
        `📧 Email sent to customer`,
      ].join('\n')
    );
  } catch (err: any) {
    console.error('[telegram] reject topup error:', err);
    await answerCallbackQuery(
      callbackQueryId,
      `❌ Error: ${err?.message ?? 'Unknown'}`
    );
  }
}
