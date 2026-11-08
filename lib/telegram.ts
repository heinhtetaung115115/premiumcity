// lib/telegram.ts
// Telegram Bot helper for PremiumCity admin notifications
// ──────────────────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const SITE_URL = process.env.NEXTAUTH_URL || 'https://premiumcity.vercel.app';

function tgApi(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
}

// ─── Types ──────────────────────────────────────────────

type InlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type SendOptions = {
  text: string;
  chatId?: string | number;
  parseMode?: 'HTML' | 'MarkdownV2';
  buttons?: InlineButton[][];
};

// ─── Low-level send ─────────────────────────────────────

export async function sendTelegramMessage(opts: SendOptions): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn('[telegram] BOT_TOKEN not set – skipping');
    return false;
  }

  const targetChat = opts.chatId || CHAT_ID;
  if (!targetChat) {
    console.warn('[telegram] No chat ID – skipping');
    return false;
  }

  const body: Record<string, unknown> = {
    chat_id: targetChat,
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
  parseMode: string = 'HTML',
  buttons?: InlineButton[][]
): Promise<void> {
  if (!BOT_TOKEN) return;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: parseMode,
  };

  if (buttons && buttons.length > 0) {
    body.reply_markup = { inline_keyboard: buttons };
  }

  await fetch(tgApi('editMessageText'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ─── Escape HTML entities ───────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Dashboard menu ─────────────────────────────────────

export function getDashboardButtons(): InlineButton[][] {
  return [
    [
      { text: '📊 Status', callback_data: 'menu:status' },
      { text: '💰 Pending Top-ups', callback_data: 'menu:topups' },
    ],
    [
      { text: '📦 Pending Orders', callback_data: 'menu:orders' },
      { text: '🔄 Refresh', callback_data: 'menu:refresh' },
    ],
    [
      { text: '🌐 Open Admin Panel', url: `${SITE_URL}/admin` },
    ],
  ];
}

export function getDashboardText(stats?: {
  pendingTopups: number;
  pendingOrders: number;
}): string {
  if (!stats) {
    return [
      '🏠 <b>PremiumCity Admin Dashboard</b>',
      '',
      'Tap a button below to get started.',
    ].join('\n');
  }

  return [
    '🏠 <b>PremiumCity Admin Dashboard</b>',
    '',
    `💰 Pending top-ups: <b>${stats.pendingTopups}</b>`,
    `📦 Pending orders: <b>${stats.pendingOrders}</b>`,
    '',
    `🕐 Updated: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Yangon', hour: '2-digit', minute: '2-digit', hour12: true })}`,
  ].join('\n');
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

/**
 * Sent when the slip-reading AI (Claude API) fails for a KBZ auto top-up.
 * Includes the slip photo, because slips aren't stored anywhere else — this
 * message is the admin's only way to see what the customer uploaded.
 * Falls back to a text-only message if the photo upload fails.
 */
export async function notifySlipAiDown(opts: {
  topupId: string;
  userEmail: string;
  amount: number;
  problem: string;
  imageBase64: string;
  mediaType: string;
}): Promise<boolean> {
  const caption = [
    '🚨 <b>Slip AI is DOWN</b>',
    `⚠️ ${esc(opts.problem)}`,
    'KBZ auto top-up moved to <b>manual review</b>. Check the slip below.',
    '',
    `👤 <b>User:</b> ${esc(opts.userEmail)}`,
    `💵 <b>Amount entered:</b> ${opts.amount.toLocaleString()} MMK`,
  ].join('\n');

  const buttons: InlineButton[][] = [
    [
      { text: '✅ Approve', callback_data: `approve_topup:${opts.topupId}` },
      { text: '❌ Reject', callback_data: `reject_topup:${opts.topupId}` },
    ],
    [{ text: '🔗 Open Admin Panel', url: `${SITE_URL}/admin/topups` }],
  ];

  if (BOT_TOKEN && CHAT_ID && opts.imageBase64) {
    try {
      const bytes = Buffer.from(opts.imageBase64, 'base64');
      const ext = opts.mediaType.includes('png') ? 'png' : opts.mediaType.includes('webp') ? 'webp' : 'jpg';
      const form = new FormData();
      form.append('chat_id', String(CHAT_ID));
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
      form.append('reply_markup', JSON.stringify({ inline_keyboard: buttons }));
      form.append('photo', new Blob([new Uint8Array(bytes)], { type: opts.mediaType || 'image/jpeg' }), `slip.${ext}`);

      const res = await fetch(tgApi('sendPhoto'), { method: 'POST', body: form });
      if (res.ok) return true;
      console.error('[telegram] sendPhoto failed:', res.status, await res.text().catch(() => ''));
    } catch (err) {
      console.error('[telegram] sendPhoto exception:', err);
    }
  }

  // Fallback: text only (e.g. photo too large)
  return sendTelegramMessage({
    text: caption + '\n\n(Slip photo could not be attached.)',
    buttons,
  });
}

export async function notifyNewManualOrder(order: {
  orderId: string;
  userEmail: string;
  productName: string;
  variantName?: string | null;
  totalAmount: number;
  manualInput?: Record<string, string> | null;
  /** e.g. account-panel slot suggestions */
  extraLines?: string[];
  extraButtons?: InlineButton[][];
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
    ...(order.extraLines?.length ? ['', ...order.extraLines] : []),
  ].join('\n');

  return sendTelegramMessage({
    text,
    buttons: [
      ...(order.extraButtons ?? []),
      [{ text: '📦 Open Orders Panel', url: `${SITE_URL}/admin/orders` }],
    ],
  });
}

export async function notifyPendingSummary(summary: {
  pendingTopups: number;
  pendingManualOrders: number;
}): Promise<boolean> {
  if (summary.pendingTopups === 0 && summary.pendingManualOrders === 0) {
    return false;
  }

  const text = [
    '🔔 <b>Reminder – Pending Items</b>',
    '',
    `💰 Pending top-ups: <b>${summary.pendingTopups}</b>`,
    '',
    summary.pendingTopups > 0
      ? `👉 <a href="${SITE_URL}/admin/topups">Review Top-ups</a>`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return sendTelegramMessage({ text });
}
