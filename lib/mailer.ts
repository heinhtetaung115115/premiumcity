import nodemailer from 'nodemailer';

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const url = process.env.SMTP_URL;
  if (!url) {
    return null;
  }
  cachedTransporter = nodemailer.createTransport(url);
  return cachedTransporter;
}

export async function sendMail({ to, subject, html }: MailOptions) {
  const transporter = getTransporter();
  if (!transporter) {
    console.info('[mailer] SMTP_URL not configured. Email would be sent to %s: %s', to, subject);
    console.info(html);
    return;
  }
  await transporter.sendMail({
    to,
    from: process.env.MAIL_FROM ?? 'no-reply@premiumcity.local',
    subject,
    html
  });
}
