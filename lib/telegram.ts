// lib/telegram.ts
// Telegram Bot helper for PremiumCity admin notifications
// ──────────────────────────────────────────────────────────
// ENV vars required:
//   TELEGRAM_BOT_TOKEN   – from @BotFather
//   TELEGRAM_CHAT_ID     – your personal / group chat ID
// ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const SITE_URL = process.env.NEXTAUTH_URL || 'https://premiumcity.vercel.app';

function tgApi(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

// ─── Low-level send ─────────────────────────────────────

type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type SendOptions = {
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  buttons?: InlineButton[][];
};

export async function sendTelegramMessage(opts: SendOptions): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[telegram] BOT_TOKEN or CHAT_ID not set – skipping notification');
    return false;
  }

  const body: Record<string, unknown> = {
    chat_id: CHAT_ID,
    text: opts.text,
    parse_mode: opts.parseMode ?? 'HTML',
  };

  if (opts.buttons && opts.buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: opts.buttons,
    };
  }

  try {
    const res = await fetch(tgApi('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[telegram] sendMessage failed:', res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[telegram] sendMessage exception:', err);
    return false;
  }
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string
): Promise<void> {
  if (!BOT_TOKEN) return;

  await fetch(tgApi('answerCallbackQuery'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text ?? 'Done',
    }),
  }).catch(() => {});
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  parseMode: string = 'HTML'
): Promise<void> {
  if (!BOT_TOKEN) return;

  await fetch(tgApi('editMessageText'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: parseMode,
    }),
  }).catch(() => {});
}

// ─── Escape HTML entities ───────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Formatted notifications ────────────────────────────

export async function notifyNewTopup(topup: {
  id: string;
  userEmail: string;
  amount: number;
  last4: string;
  bankName?: string;
  method?: string;
}): Promise<boolean> {
  const text = [
    '💰 <b>New Top-Up Request</b>',
    '',
    `👤 <b>User:</b> ${esc(topup.userEmail)}`,
    `💵 <b>Amount:</b> ${topup.amount.toLocaleString()} MMK`,
    `🏦 <b>Bank:</b> ${esc(topup.bankName || 'N/A')}`,
    `🔢 <b>Last 4:</b> ${topup.last4}`,
    `📋 <b>Method:</b> ${topup.method || 'account'}`,
    '',
    `🔗 <a href="${SITE_URL}/admin/topups">Open Admin Panel</a>`,
  ].join('\n');

  return sendTelegramMessage({
    text,
    buttons: [
      [
        { text: '✅ Approve', callback_data: `approve_topup:${topup.id}` },
        { text: '❌ Reject', callback_data: `reject_topup:${topup.id}` },
      ],
      [{ text: '🔗 Open Admin Panel', url: `${SITE_URL}/admin/topups` }],
    ],
  });
}

export async function notifyNewManualOrder(order: {
  orderId: string;
  userEmail: string;
  productName: string;
  variantName?: string | null;
  totalAmount: number;
  manualInput?: Record<string, string> | null;
}): Promise<boolean> {
  const inputLines = order.manualInput
    ? Object.entries(order.manualInput)
        .map(([key, val]) => `  • <b>${esc(key)}:</b> ${esc(String(val))}`)
        .join('\n')
    : '  (none)';

  const text = [
    '📦 <b>New Manual Order – Action Required</b>',
    '',
    `👤 <b>User:</b> ${esc(order.userEmail)}`,
    `🛒 <b>Product:</b> ${esc(order.productName)}${order.variantName ? ` (${esc(order.variantName)})` : ''}`,
    `💵 <b>Total:</b> ${order.totalAmount.toLocaleString()} MMK`,
    '',
    `📝 <b>Customer Input:</b>`,
    inputLines,
    '',
    `🔗 <a href="${SITE_URL}/admin/orders">Open Admin Panel</a>`,
  ].join('\n');

  return sendTelegramMessage({
    text,
    buttons: [
      [{ text: '📦 Open Orders Panel', url: `${SITE_URL}/admin/orders` }],
    ],
  });
}

export async function notifyPendingSummary(summary: {
  pendingTopups: number;
  pendingManualOrders: number;
}): Promise<boolean> {
  if (summary.pendingTopups === 0 && summary.pendingManualOrders === 0) {
    return false; // nothing pending, don't spam
  }

  const text = [
    '🔔 <b>PremiumCity – Pending Items Reminder</b>',
    '',
    `💰 Pending top-ups: <b>${summary.pendingTopups}</b>`,
    `📦 Unfulfilled manual orders: <b>${summary.pendingManualOrders}</b>`,
    '',
    summary.pendingTopups > 0
      ? `👉 <a href="${SITE_URL}/admin/topups">Review Top-ups</a>`
      : '',
    summary.pendingManualOrders > 0
      ? `👉 <a href="${SITE_URL}/admin/orders">Review Orders</a>`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return sendTelegramMessage({ text });
}
