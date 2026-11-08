// lib/panel/rules.ts
// Which forwarded emails customers may see. DEFAULT DENY: an email is shown
// only if it comes from the service's own domain, looks like a login code /
// verification email, and does NOT look like a password, email or billing
// change. Admins always see everything in the inbox.

export type ServiceKey = 'crunchyroll' | 'netflix' | 'prime' | 'capcut' | 'other';

export const SERVICES: Record<ServiceKey, { name: string; senders: string[]; color: string }> = {
  crunchyroll: { name: 'Crunchyroll', senders: ['crunchyroll.com'], color: '#f47521' },
  netflix: { name: 'Netflix', senders: ['netflix.com'], color: '#e50914' },
  prime: { name: 'Prime Video', senders: ['amazon.com', 'primevideo.com', 'amazon.co.uk', 'amazon.sg'], color: '#1a98ff' },
  capcut: { name: 'CapCut', senders: ['capcut.com', 'bytedance.com'], color: '#ffffff' },
  other: { name: 'Account', senders: [], color: '#818cf8' },
};

export function serviceInfo(key: string | null | undefined) {
  return SERVICES[(key as ServiceKey) in SERVICES ? (key as ServiceKey) : 'other'];
}

const ALLOW =
  /(code|verif|sign[\s-]?in|log[\s-]?in|one[\s-]?time|otp|passcode|temporary access|household|new device|confirm (?:it'?s|your) (?:you|login|sign))/i;
const BLOCK =
  /(password|reset|e-?mail (?:address )?(?:was |has been )?(?:change|update)|chang\w* (?:your |the )?e-?mail|updat\w* (?:your |the )?e-?mail|new e-?mail|account (?:delet|change|update|recovery)|recover|cancel|subscription|membership|payment|billing|receipt|invoice|order|refund|card|phone number)/i;

export type Classification = {
  verdict: 'allowed' | 'blocked';
  reason: string;
  code: string | null;
  link: string | null;
};

function senderDomain(from: string): string {
  const m = from.toLowerCase().match(/@([a-z0-9.-]+)/);
  return m ? m[1] : '';
}

function stripUrls(t: string): string {
  return t.replace(/https?:\/\/\S+/gi, ' ');
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** A 4–8 digit code sitting near the word "code" (or alone in a short email). */
export function extractCode(subject: string, text: string): string | null {
  const t = stripUrls(`${subject}\n${text}`);
  const near = t.match(/(?:code|passcode|otp|verification)[^0-9]{0,60}?\b(\d{4,8})\b/i);
  if (near) return near[1];
  const before = t.match(/\b(\d{4,8})\b[^0-9]{0,40}?(?:is your|code)/i);
  if (before) return before[1];
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Only links on the service's own domain (stops spoofed emails pushing phishing links). */
function onServiceDomain(url: string, senders: string[]): boolean {
  if (!senders.length) return true;
  const h = hostOf(url);
  return senders.some((d) => h === d || h.endsWith(`.${d}`));
}

/** First button-like link that verifies / signs in (never reset/unsubscribe links). */
export function extractActionLink(html: string, text: string, senders: string[] = []): string | null {
  const candidates: { url: string; label: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    candidates.push({ url: m[1].replace(/&amp;/g, '&'), label: htmlToText(m[2]) });
  }
  for (const m of text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) candidates.push({ url: m[0], label: '' });
  const good = /(this was me|it was me|it'?s me|verif|confirm|sign[-_ ]?in|log[-_ ]?in|activate|access|code|yes|approve)/i;
  const bad =
    /(not me|wasn'?t (?:me|you)|click here|secure your|unsubscribe|password|reset|privacy|terms|help|support|preferences|cancel|email[-_ ]?change|account\/?settings|learn more|mailto:)/i;
  // Judge by the BUTTON TEXT. Tracking links (links.mail.crunchyroll.com/ls/click?upn=…)
  // are long random strings that can contain "help"/"reset" by chance, so the
  // URL itself is only checked (host + path, no query) when there's no text.
  const pathOf = (u: string) => {
    try {
      const x = new URL(u);
      return `${x.hostname}${x.pathname}`;
    } catch {
      return u;
    }
  };
  // 1) Buttons with a clear "this was me / verify / sign in" label win.
  for (const c of candidates) {
    if (!/^https?:\/\//i.test(c.url) || !onServiceDomain(c.url, senders)) continue;
    if (c.label && !bad.test(c.label) && good.test(c.label)) return c.url;
  }
  // 2) Otherwise a bare link whose path looks like verification.
  for (const c of candidates) {
    if (!/^https?:\/\//i.test(c.url) || !onServiceDomain(c.url, senders)) continue;
    if (c.label) continue;
    const p = pathOf(c.url);
    if (!bad.test(p) && good.test(p)) return c.url;
  }
  return null;
}

/**
 * When the mailbox owner uses Outlook/Gmail "Forward" (not Redirect), the
 * email comes FROM the account itself and the original sender is quoted in
 * the body ("From: Crunchyroll <…>"). Use that original sender.
 */
function originalSender(from: string, body: string, accountEmail: string | null): string {
  if (!accountEmail) return from;
  const fromAddr = (from.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] || '').toLowerCase();
  if (fromAddr !== accountEmail.toLowerCase()) return from;
  const quoted = body.match(/^\s*(?:From|Från|Von|De)\s*:\s*(.*@.*)$/im);
  return quoted ? quoted[1] : from;
}

export function classify(
  service: string | null,
  from: string,
  subject: string,
  text: string,
  html: string,
  accountEmail: string | null = null
): Classification {
  const body = text || htmlToText(html);
  const svc = serviceInfo(service);
  subject = subject.replace(/^\s*(?:fwd?|fw|tr|wg)\s*:\s*/i, '');
  from = originalSender(from, body, accountEmail);
  const domain = senderDomain(from);
  const code = extractCode(subject, body);
  const link = extractActionLink(html, text, svc.senders);

  if (svc.senders.length && !svc.senders.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return { verdict: 'blocked', reason: `Sender ${domain || '?'} is not ${svc.name}`, code, link };
  }
  if (BLOCK.test(subject)) return { verdict: 'blocked', reason: 'Account/password/billing change email', code, link };
  if (!ALLOW.test(subject) && !code) {
    return { verdict: 'blocked', reason: 'Not a login or verification email', code, link };
  }
  // Body check catches "reset your password" emails with vague subjects.
  if (!code && BLOCK.test(body.slice(0, 600)) && !ALLOW.test(subject)) {
    return { verdict: 'blocked', reason: 'Looks like an account change email', code, link };
  }
  return { verdict: 'allowed', reason: 'Login / verification email', code, link };
}
