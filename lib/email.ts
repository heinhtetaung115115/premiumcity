// lib/email.ts
export const runtime = 'nodejs';

import sgMail from '@sendgrid/mail';
import { Resend } from 'resend';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

if (!SENDGRID_API_KEY) {
  console.warn(
    'WARN: SENDGRID_API_KEY is not set. SendGrid will be skipped as primary provider.'
  );
} else {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

const resendClient = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
if (!RESEND_API_KEY) {
  console.warn(
    'WARN: RESEND_API_KEY is not set. Resend fallback provider will be disabled.'
  );
}

const FROM = process.env.EMAIL_FROM || 'no-reply@example.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Premium City';

type SendOpts = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

type SendResult = {
  ok?: boolean; // true on success, false on failure
  skipped?: boolean; // true if provider not configured
  error?: string;
  provider?: 'sendgrid' | 'resend' | string;
};

// --- internal helpers ---

async function sendWithSendGrid(opts: SendOpts): Promise<SendResult> {
  if (!SENDGRID_API_KEY) {
    return { skipped: true, provider: 'sendgrid' };
  }

  const msg = {
    to: opts.to,
    from: { email: FROM, name: FROM_NAME },
    subject: opts.subject,
    text: opts.text ?? '',
    html: opts.html ?? undefined,
  };

  try {
    await sgMail.send(msg as any);
    return { ok: true, provider: 'sendgrid' };
  } catch (e: any) {
    const body = e?.response?.body || e?.message || e;
    console.error('SendGrid error:', body);

    const messageText =
      typeof body === 'string'
        ? body
        : body?.errors?.[0]?.message || e?.message || 'SendGrid send failed';

    return {
      ok: false,
      error: messageText,
      provider: 'sendgrid',
    };
  }
}

async function sendWithResend(opts: SendOpts): Promise<SendResult> {
  if (!resendClient || !RESEND_API_KEY) {
    return { skipped: true, provider: 'resend' };
  }

  try {
    const { error } = await resendClient.emails.send({
      from: `${FROM_NAME} <${FROM}>`,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      text: opts.text ?? undefined,
      html: opts.html ?? undefined,
    });

    if (error) {
      console.error('Resend error:', error);
      return {
        ok: false,
        error: error.message || 'Resend send failed',
        provider: 'resend',
      };
    }

    return { ok: true, provider: 'resend' };
  } catch (e: any) {
    console.error('Resend exception:', e?.message || e);
    return {
      ok: false,
      error: e?.message || 'Resend send failed',
      provider: 'resend',
    };
  }
}

// --- main function used by the rest of your app ---

export async function sendEmail(opts: SendOpts): Promise<SendResult> {
  // If neither provider is configured
  if (!SENDGRID_API_KEY && !RESEND_API_KEY) {
    console.warn(
      'sendEmail: no SENDGRID_API_KEY or RESEND_API_KEY configured. Email will not be sent.'
    );
    return { ok: false, error: 'No email provider configured' };
  }

  // 1) Try SendGrid first if configured
  if (SENDGRID_API_KEY) {
    const res = await sendWithSendGrid(opts);

    if (res.ok) {
      return res;
    }

    // If SendGrid failed and Resend is available, fall back
    if (RESEND_API_KEY && resendClient) {
      console.warn(
        `sendEmail: falling back to Resend after SendGrid error: ${res.error}`
      );
      const fallbackRes = await sendWithResend(opts);

      if (fallbackRes.ok) {
        return fallbackRes;
      }

      return fallbackRes;
    }

    // No fallback available, return SendGrid error / result
    return res;
  }

  // 2) If SendGrid not configured, but Resend is → use Resend directly
  if (RESEND_API_KEY && resendClient) {
    return await sendWithResend(opts);
  }

  // Should not reach here, but just in case
  return { ok: false, error: 'No email provider configured' };
}

/* ---------- Topup templates ---------- */

export function tplTopupSubmitted(
  userName: string,
  amount: number,
  last4: string
) {
  const amt = Number(amount).toLocaleString();
  const safeName = userName || 'there';

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial; font-size:14px; line-height:1.5;">
      <h2 style="margin-bottom:8px;">We received your top-up request</h2>
      <p>Hi ${safeName},</p>
      <p>
        Thank you for using Premium City. We have successfully received your wallet top-up request and it is now
        <strong>pending review</strong>.
      </p>
      <p>Here are the details for your reference:</p>
      <ul>
        <li><b>Amount:</b> ${amt} MMK</li>
        <li><b>Last 4 digits of transaction:</b> ${last4}</li>
      </ul>
      <p>
        Our team will review your payment shortly. Once your top-up is approved and your wallet is credited, you will
        receive a separate confirmation email.
      </p>
      <p>
        If you did not initiate this request, or if you have any questions about this transaction, please contact our
        support team at <a href="mailto:support@pcitystore.com">support@pcitystore.com</a>.
      </p>
      <p style="margin-top:16px;">
        Thank you for choosing Premium City,<br/>
        <strong>Premium City Support</strong>
      </p>
    </div>`;

  const text = `We received your top-up request

Hi ${safeName},

Thank you for using Premium City. We have received your wallet top-up request and it is now pending review.

Details:
- Amount: ${amt} MMK
- Last 4 digits of transaction: ${last4}

Our team will review your payment shortly. You will receive another email once your wallet has been credited.

If you did not initiate this request or have any questions, please contact our support team at support@pcitystore.com.

Thank you,
Premium City Support`;

  return { html, text };
}

export function tplTopupAdminNotify(
  userEmail: string,
  amount: number,
  last4: string,
  topupId: string | null,
  paymentInfo?: string
) {
  const amt = Number(amount).toLocaleString();

  const paymentLine = paymentInfo ? `Payment: ${paymentInfo}` : '';

  const text = `Top-up submitted
User: ${userEmail}
Amount: ${amt} MMK
Last4: ${last4}
${paymentLine ? paymentLine + '\n' : ''}Topup ID: ${topupId ?? 'n/a'}`;

  const paymentHtml = paymentInfo
    ? `<li><b>Payment:</b> ${paymentInfo}</li>`
    : '';

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h3>New top-up submitted</h3>
      <ul>
        <li><b>User:</b> ${userEmail}</li>
        <li><b>Amount:</b> ${amt} MMK</li>
        <li><b>Last 4:</b> ${last4}</li>
        ${paymentHtml}
        <li><b>Topup ID:</b> ${topupId ?? 'n/a'}</li>
      </ul>
    </div>`;
  return { html, text };
}

export function tplTopupApproved(
  userName: string,
  amount: number,
  newBalance?: number
) {
  const amt = Number(amount).toLocaleString();
  const safeName = userName || 'there';

  const balanceText =
    newBalance != null
      ? `Your new wallet balance is <strong>${Number(newBalance).toLocaleString()} MMK</strong>.`
      : '';

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial; font-size:14px; line-height:1.5;">
      <h2 style="margin-bottom:8px;">Top-Up Approved</h2>
      <p>Hi ${safeName},</p>
      <p>
        Your payment has been reviewed and your Premium City wallet has been successfully credited.
      </p>
      <p>
        <strong>Amount added:</strong> ${amt} MMK<br/>
        ${balanceText}
      </p>
      <p>
        You can now continue using Premium City services without interruption. If you have any questions about this
        transaction, please contact our support team at
        <a href="mailto:support@pcitystore.com">support@pcitystore.com</a>.
      </p>
      <p style="margin-top:16px;">
        Thank you for choosing Premium City,<br/>
        <strong>Premium City Support</strong>
      </p>
    </div>`;

  const balanceTextPlain =
    newBalance != null
      ? `Your new wallet balance is ${Number(newBalance).toLocaleString()} MMK.\n`
      : '';

  const text = `Top-Up Approved

Hi ${safeName},

Your payment has been reviewed and your Premium City wallet has been credited.

Amount added: ${amt} MMK
${balanceTextPlain}
You can now continue using Premium City services without interruption. If you have any questions about this transaction, please contact our support team at support@pcitystore.com.

Thank you,
Premium City Support`;

  return { html, text };
}

/**
 * Topup rejected template
 */
export function tplTopupRejected(
  userName: string,
  amount: number,
  reason?: string
) {
  const amt = Number(amount).toLocaleString();
  const reasonLine = reason
    ? `Reason: ${reason}`
    : 'If you have any questions, you can reply to this email.';

  const contactLine =
    'Please contact Viber +959740934551 or support@pcitystore.com if you need help.';

  const text = `Top-up not approved
Amount: ${amt} MMK
${reasonLine}
${contactLine}`;

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h2>Top-up not approved</h2>
      <p>Hi ${userName || 'there'},</p>
      <p>We couldn’t approve your top-up of <b>${amt} MMK</b>.</p>
      <p>${reasonLine}</p>
      <p>${contactLine}</p>
      <p>— Premium City</p>
    </div>`;

  return { html, text };
}

/* ---------- Manual order admin template ---------- */

type ManualAdminItem = {
  productName: string;
  variantName: string | null;
  productType: 'INSTANT' | 'MANUAL';
  manualInput: Record<string, string> | null;
};

export function tplManualOrderAdmin(
  userEmail: string,
  orderId: string,
  items: ManualAdminItem[]
) {
  const rowsHtml = items
    .map((item, idx) => {
      const manualHtml =
        item.manualInput && Object.keys(item.manualInput).length > 0
          ? `<ul>${Object.entries(item.manualInput)
              .map(
                ([k, v]) =>
                  `<li><b>${k}:</b> ${String(v)}</li>`
              )
              .join('')}</ul>`
          : '<p><i>No manual input captured.</i></p>';

      return `
        <li>
          <p><b>Item ${idx + 1}:</b> ${item.productName}${
        item.variantName ? ' · ' + item.variantName : ''
      }</p>
          <p>Type: ${item.productType}</p>
          <div>${manualHtml}</div>
        </li>
      `;
    })
    .join('');

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial">
      <h3>New manual order received</h3>
      <p><b>Order ID:</b> ${orderId}</p>
      <p><b>User:</b> ${userEmail || 'unknown'}</p>
      <p>The following manual items were ordered:</p>
      <ul>
        ${rowsHtml}
      </ul>
      <p>You can fulfill this order from the admin orders panel.</p>
    </div>
  `;

  const textItems = items
    .map((item, idx) => {
      const mi =
        item.manualInput && Object.keys(item.manualInput).length > 0
          ? Object.entries(item.manualInput)
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(', ')
          : 'No manual input captured.';
      return `Item ${idx + 1}: ${item.productName}${
        item.variantName ? ' · ' + item.variantName : ''
      } | Type: ${item.productType} | ${mi}`;
    })
    .join('\n');

  const text = `New manual order received
Order ID: ${orderId}
User: ${userEmail || 'unknown'}

${textItems}

You can fulfill this order from the admin orders panel.`;

  return { html, text };
}

/* ---------- Stock depleted admin template ---------- */

export function tplStockDepletedAdmin(
  productName: string,
  productId: string,
  categoryName?: string | null
) {
  const subject = `Stock alert: ${productName} is now out of stock`;

  const lines = [
    'Product out of stock',
    `Product: ${productName}`,
    categoryName ? `Category: ${categoryName}` : '',
    `Product ID: ${productId}`,
    '',
    'This product currently has zero available inventory items.',
    'Please log in to the admin panel to refill stock as soon as possible.',
  ].filter(Boolean);

  const text = lines.join('\n');

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial; font-size:14px; line-height:1.5%;">
      <h2>Stock alert: product is out of stock</h2>
      <p><strong>Product:</strong> ${productName}</p>
      ${categoryName ? `<p><strong>Category:</strong> ${categoryName}</p>` : ''}
      <p><strong>Product ID:</strong> ${productId}</p>
      <p>This product currently has <b>zero available inventory items</b>.</p>
      <p>Please sign in to the admin panel and refill the stock as soon as possible.</p>
    </div>
  `;

  return { subject, text, html };
}

/* ---------- Manual delivery to user template ---------- */

export function getAdminRecipients(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
// Customer order emails — shared layout
// ─────────────────────────────────────────────────────────────

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://pcitystore.com').replace(/\/$/, '');
const ORDERS_URL = `${SITE_URL}/orders`;
const ORDERS_URL_LABEL = ORDERS_URL.replace(/^https?:\/\//, '');

function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Short order label shown to customers, e.g. "#a1b2c3d4" (matches the Orders page). */
export function shortOrderLabel(orderId: string | null | undefined): string {
  return orderId ? `#${String(orderId).slice(0, 8)}` : '';
}

/**
 * One layout for order emails. Table-based with inline styles so it renders
 * in Gmail / Outlook / phone mail apps. `accent` gives each email its own look.
 */
function orderEmailLayout(o: {
  accent: string; // header + button colour
  badge: string; // small label in the coloured header
  title: string;
  name: string;
  paragraphs: string[]; // already-escaped HTML
  note?: string;
  buttonLabel: string;
  /** Defaults to the PremiumCity Orders page. */
  buttonUrl?: string;
}): string {
  const btnUrl = o.buttonUrl || ORDERS_URL;
  const btnUrlLabel = btnUrl.replace(/^https?:\/\//, '');
  const noteHtml = o.note
    ? `<tr><td style="padding:0 28px 8px;">
         <div style="background:#f8fafc;border-left:3px solid ${o.accent};padding:10px 14px;font-size:14px;color:#334155;">
           <strong>Note from our team:</strong><br/>${esc(o.note).replace(/\n/g, '<br/>')}
         </div>
       </td></tr>`
    : '';

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;">
  <tr><td style="background:${o.accent};padding:18px 28px;">
    <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#ffffff;opacity:.85;">${esc(o.badge)}</div>
    <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:4px;">${esc(o.title)}</div>
  </td></tr>
  <tr><td style="padding:24px 28px 8px;font-size:15px;line-height:1.6;color:#0f172a;">
    <p style="margin:0 0 12px;">Hi ${esc(o.name)},</p>
    ${o.paragraphs.map((p) => `<p style="margin:0 0 12px;">${p}</p>`).join('\n    ')}
  </td></tr>
  ${noteHtml}
  <tr><td align="center" style="padding:12px 28px 8px;">
    <a href="${btnUrl}" target="_blank"
       style="display:inline-block;background:${o.accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 28px;border-radius:8px;">
      ${esc(o.buttonLabel)}
    </a>
  </td></tr>
  <tr><td align="center" style="padding:4px 28px 20px;font-size:13px;color:#64748b;">
    or open <a href="${btnUrl}" target="_blank" style="color:${o.accent};">${esc(btnUrlLabel)}</a>
  </td></tr>
  <tr><td style="padding:16px 28px 22px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;line-height:1.5;">
    Please keep your login details private.<br/>
    Thank you for shopping with <strong style="color:#0f172a;">Premium City</strong>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** Sent when a manual order has been delivered. Green "ready" style. */
export function tplManualDeliveryToUser(o: {
  name: string;
  orderId: string | null;
  productName?: string | null;
  note?: string;
}) {
  const label = shortOrderLabel(o.orderId);
  const product = o.productName?.trim() || 'your order';
  const subject = `Your ${product} is ready${label ? ` (order ${label})` : ''}`;
  const note = o.note?.trim() || undefined;

  const html = orderEmailLayout({
    accent: '#059669',
    badge: 'Order ready',
    title: 'Your order is ready',
    name: o.name,
    paragraphs: [
      `Good news! We have delivered <strong>${esc(product)}</strong>${
        label ? ` for your order <strong>${esc(label)}</strong>` : ''
      }.`,
      'Your login details are waiting on your Orders page.',
    ],
    note,
    buttonLabel: 'View my order',
  });

  const text = `Hi ${o.name},

Good news! We have delivered ${product}${label ? ` for your order ${label}` : ''}.
Your login details are waiting on your Orders page:
${ORDERS_URL}
${note ? `\nNote from our team:\n${note}\n` : ''}
Please keep your login details private.
Thank you for shopping with Premium City`;

  return { subject, html, text };
}

/**
 * Sent when an admin updates the login details on an already-delivered order
 * (e.g. a warranty replacement). Amber "updated" style. The new password is
 * NOT included — the customer sees it on their Orders page.
 */
export function tplAccountUpdatedToUser(o: {
  name: string;
  orderId: string | null;
  productName?: string | null;
  note?: string;
}) {
  const label = shortOrderLabel(o.orderId);
  const product = o.productName?.trim() || 'your product';
  const subject = `We've updated your ${product} account${label ? ` (order ${label})` : ''}`;
  const note = o.note?.trim() || undefined;

  const html = orderEmailLayout({
    accent: '#d97706',
    badge: 'Account updated',
    title: 'Your account details were updated',
    name: o.name,
    paragraphs: [
      `We have updated the login details for <strong>${esc(product)}</strong>${
        label ? ` in your order <strong>${esc(label)}</strong>` : ''
      }.`,
      'Please use the new email / password from your Orders page — the old details will no longer work.',
    ],
    note,
    buttonLabel: 'See updated details',
  });

  const text = `Hi ${o.name},

We have updated the login details for ${product}${label ? ` in your order ${label}` : ''}.
Please use the new email / password from your Orders page — the old details will no longer work:
${ORDERS_URL}
${note ? `\nNote from our team:\n${note}\n` : ''}
Please keep your login details private.
Thank you for shopping with Premium City`;

  return { subject, html, text };
}

/** Account panel (pcity.online): password changed by admin. */
export function tplPanelPasswordUpdated(o: { name: string; service: string; linkUrl: string; note?: string }) {
  const subject = `Your ${o.service} password was updated`;
  const html = orderEmailLayout({
    accent: '#d97706',
    badge: 'Password updated',
    title: `New ${o.service} password`,
    name: o.name,
    paragraphs: [
      `The password for your <strong>${esc(o.service)}</strong> account has been updated.`,
      'Open your account link to see the new password. The old password will no longer work.',
    ],
    note: o.note,
    buttonLabel: 'See new password',
    buttonUrl: o.linkUrl,
  });
  const text = `Hi ${o.name},

The password for your ${o.service} account has been updated.
See the new password here: ${o.linkUrl}
${o.note ? `\nNote from our team:\n${o.note}\n` : ''}
Please keep your login details private.
Thank you for shopping with Premium City`;
  return { subject, html, text };
}
