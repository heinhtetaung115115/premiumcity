const SENDGRID_ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

function buildPayload({ to, subject, html }: MailOptions) {
  // ✅ Reuse the same env vars as lib/email.ts first,
  //    then fall back to the SENDGRID_* ones, then a safe default.
  const fromEmail =
    process.env.EMAIL_FROM ||
    process.env.SENDGRID_FROM_EMAIL ||
    'no-reply@example.com';

  const fromName =
    process.env.EMAIL_FROM_NAME ||
    process.env.SENDGRID_FROM_NAME ||
    'Premium City';

  return {
    personalizations: [
      {
        to: [{ email: to }]
      }
    ],
    from: {
      email: fromEmail,
      name: fromName
    },
    subject,
    content: [
      {
        type: 'text/html',
        value: html
      }
    ]
  };
}

export async function sendMail(options: MailOptions) {
  const apiKey = process.env.SENDGRID_API_KEY;

  if (!apiKey) {
    console.info(
      '[mailer] SENDGRID_API_KEY not configured. Email would be sent to %s: %s',
      options.to,
      options.subject
    );
    console.info(options.html);
    return;
  }

  const response = await fetch(SENDGRID_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildPayload(options))
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to send email via SendGrid');
  }
}
