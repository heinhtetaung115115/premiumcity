// app/api/telegram-webhook/route.ts
// Handles incoming Telegram updates (callback buttons + commands)
// ──────────────────────────────────────────────────────────────
// Set your webhook via:
//   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
//     -d "url=https://your-domain.com/api/telegram-webhook&secret_token=YOUR_WEBHOOK_SECRET"
// ──────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server';
import { getServiceSupabaseClient } from '@/lib/supabase';
import {
  answerCallbackQuery,
  editMessageText,
  sendTelegramMessage,
  notifyPendingSummary,
} from '@/lib/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export async function POST(req: Request) {
  // Verify webhook secret (Telegram sends it in X-Telegram-Bot-Api-Secret-Token header)
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

  // ─── Handle callback queries (inline button presses) ──

  if (update.callback_query) {
    const cb = update.callback_query;
    const data: string = cb.data || '';
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;

    // Verify the callback is from the admin chat
    if (String(chatId) !== String(ADMIN_CHAT_ID)) {
      await answerCallbackQuery(cb.id, '⛔ Unauthorized');
      return NextResponse.json({ ok: true });
    }

    if (data.startsWith('approve_topup:')) {
      const topupId = data.replace('approve_topup:', '');
      await handleApproveTopup(topupId, cb.id, chatId, messageId);
    } else if (data.startsWith('reject_topup:')) {
      const topupId = data.replace('reject_topup:', '');
      await handleRejectTopup(topupId, cb.id, chatId, messageId);
    } else {
      await answerCallbackQuery(cb.id, 'Unknown action');
    }

    return NextResponse.json({ ok: true });
  }

  // ─── Handle text commands ─────────────────────────────

  if (update.message?.text) {
    const text: string = update.message.text.trim();
    const chatId = update.message.chat?.id;

    if (String(chatId) !== String(ADMIN_CHAT_ID)) {
      return NextResponse.json({ ok: true });
    }

    if (text === '/status' || text === '/pending') {
      await handleStatusCommand();
    } else if (text === '/chatid') {
      await sendTelegramMessage({
        text: `Your chat ID is: <code>${chatId}</code>`,
      });
    } else if (text === '/help' || text === '/start') {
      await sendTelegramMessage({
        text: [
          '🤖 <b>PremiumCity Bot Commands</b>',
          '',
          '/status – Show pending top-ups & manual orders',
          '/pending – Same as /status',
          '/chatid – Show your chat ID',
          '/help – Show this help message',
          '',
          'You will also receive automatic alerts for:',
          '• New top-up requests (with approve/reject buttons)',
          '• New manual orders that need fulfillment',
        ].join('\n'),
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// ─── Approve top-up via Telegram ────────────────────────

async function handleApproveTopup(
  topupId: string,
  callbackQueryId: string,
  chatId: number,
  messageId: number
) {
  const supabase = getServiceSupabaseClient();

  try {
    // Check current status
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
      await answerCallbackQuery(
        callbackQueryId,
        `Already ${t.status.toLowerCase()}`
      );
      await editMessageText(
        chatId,
        messageId,
        `✅ This top-up was already <b>${(t.status as string).toLowerCase()}</b>.`
      );
      return;
    }

    // Credit wallet
    const userId = t.user_id as string;
    const amount = Number(t.amount);

    // Ensure wallet exists
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
      description: 'Top-up approved (via Telegram)',
    });

    // Mark topup as APPROVED
    await supabase
      .from('topups')
      .update({ status: 'APPROVED' })
      .eq('id', topupId);

    await answerCallbackQuery(callbackQueryId, '✅ Approved!');
    await editMessageText(
      chatId,
      messageId,
      [
        '✅ <b>Top-Up Approved</b> (via Telegram)',
        '',
        `💵 Amount: ${amount.toLocaleString()} MMK`,
        `💳 New balance: ${newBalance.toLocaleString()} MMK`,
        `🔢 Last 4: ${t.last4}`,
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

// ─── Reject top-up via Telegram ─────────────────────────

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
      .select('id,status,amount,last4')
      .eq('id', topupId)
      .maybeSingle();

    if (fetchErr || !topup) {
      await answerCallbackQuery(callbackQueryId, '❌ Top-up not found');
      return;
    }

    const t = topup as any;

    if (t.status !== 'PENDING') {
      await answerCallbackQuery(
        callbackQueryId,
        `Already ${t.status.toLowerCase()}`
      );
      await editMessageText(
        chatId,
        messageId,
        `This top-up was already <b>${(t.status as string).toLowerCase()}</b>.`
      );
      return;
    }

    await supabase
      .from('topups')
      .update({ status: 'REJECTED' })
      .eq('id', topupId);

    await answerCallbackQuery(callbackQueryId, '❌ Rejected');
    await editMessageText(
      chatId,
      messageId,
      [
        '❌ <b>Top-Up Rejected</b> (via Telegram)',
        '',
        `💵 Amount: ${Number(t.amount).toLocaleString()} MMK`,
        `🔢 Last 4: ${t.last4}`,
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

// ─── /status command ────────────────────────────────────

async function handleStatusCommand() {
  const supabase = getServiceSupabaseClient();

  try {
    const { data: topups } = await supabase
      .from('topups')
      .select('id')
      .eq('status', 'PENDING');

    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'PENDING_FULFILLMENT');

    await notifyPendingSummary({
      pendingTopups: (topups ?? []).length,
      pendingManualOrders: (orders ?? []).length,
    });
  } catch (err) {
    console.error('[telegram] status command error:', err);
    await sendTelegramMessage({
      text: '❌ Failed to fetch pending items. Check server logs.',
    });
  }
}
