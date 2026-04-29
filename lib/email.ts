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

export function tplManualDeliveryToUser(
  userEmail: string,
  orderNumber: string | number | null,
  note?: string
) {
  const orderLabel = orderNumber ? `#${orderNumber}` : '';
  const safeNote = note?.trim();

  const subject = orderLabel
    ? `Your Premium City order ${orderLabel} is ready`
    : 'Your Premium City order is ready';

  const htmlNote = safeNote
    ? `<p style="margin-top:8px;"><strong>Note from our team:</strong><br/>${safeNote}</p>`
    : '';

  const textNote = safeNote
    ? `\nNote from our team:\n${safeNote}\n`
    : '';

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial; font-size:14px; line-height:1.5%;">
      <h2 style="margin-bottom:8px;">Your manual order is ready</h2>
      <p>Hi,</p>
      <p>
        We have delivered the manual product(s) for your Premium City order
        <strong>${orderLabel || ''}</strong>.
      </p>
      <p>
        You can now view your login details / access information in the
        <strong>Orders</strong> page after signing in to your Premium City account
        (${userEmail}).
      </p>
      <p>
        Please keep your credentials safe and do not share them with anyone you do not trust.
      </p>
      ${htmlNote}
      <p style="margin-top:16px;">
        Thank you for using Premium City,<br/>
        <strong>Premium City Support</strong>
      </p>
    </div>
  `;

  const text = `Your manual order is ready

We have delivered the manual product(s) for your Premium City order ${orderLabel || ''}.

You can now view your login details / access information in the Orders page after signing in to your Premium City account (${userEmail}).

Please keep your credentials safe and do not share them with anyone you do not trust.${textNote}

Thank you,
Premium City Support`;

  return { subject, html, text };
}

/* ---------- Admin recipients helper ---------- */

export function getAdminRecipients(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
