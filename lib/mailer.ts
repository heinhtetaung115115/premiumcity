import sgMail from '@sendgrid/mail';

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

let isConfigured = false;

function ensureConfigured() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    return false;
  }
  if (!isConfigured) {
    sgMail.setApiKey(apiKey);
    isConfigured = true;
  }
  return true;
}

export async function sendMail({ to, subject, html }: MailOptions) {
  if (!ensureConfigured()) {
    console.info('[mailer] SENDGRID_API_KEY not configured. Email would be sent to %s: %s', to, subject);
    console.info(html);
    return;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'no-reply@premiumcity.local';
  const fromName = process.env.SENDGRID_FROM_NAME ?? 'PremiumCity';

  await sgMail.send({
    to,
    from: { email: fromEmail, name: fromName },
    subject,
    html
  });
}
