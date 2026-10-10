// lib/netflix.ts
// Reads a reseller "account panel" link and returns the live account data.
//
// HOW THE LINK WORKS (discovered by inspecting the panel):
//   The customer-facing page is:   https://<supplier-host>/c/<token>
//   Its data comes from a JSON API: https://<supplier-host>/api/c/<token>
//   i.e. the SAME url with "/api" inserted before the path.
//   Known supplier hosts: resellerpanel.store, txtl.online (same JSON shape).
//
// The JSON looks like:
//   { success: true, data: {
//       profile: { email, password, name, pin, endDate },
//       messages: [ ... ]   // OTP / sign-in codes land here, live ~15 min
//   } }
//
// We store only the LINK against an order. We never store the password or
// codes — they're fetched live each time, so a changed password or a fresh
// code is always current, and nothing sensitive sits in our database.

export type NetflixProfile = {
  email: string | null;
  password: string | null;
  name: string | null;
  pin: string | null;
  endDate: string | null;
};

export type NetflixMessage = {
  subject: string | null;
  from: string | null;
  code: string | null;
  body: string | null;
  date: string | null;
  /**
   * Action link from the email's button — Netflix Household / temporary-access
   * emails ("Yes, This Was Me", "Get Code") have a link, not a number.
   */
  link: string | null;
  linkLabel: string | null;
  /** Milliseconds since epoch when the message arrived, if we could parse it. */
  timestamp: number | null;
};

export type NetflixPanel = {
  ok: boolean;
  profile: NetflixProfile | null;
  messages: NetflixMessage[];
  error?: string;
};

/** Only allow links from the known supplier host — never fetch arbitrary URLs. */
/** Only allow links from known supplier hosts — never fetch arbitrary URLs. */
const ALLOWED_HOSTS = new Set([
  'resellerpanel.store',
  'www.resellerpanel.store',
  'txtl.online',
  'www.txtl.online',
]);

/** Convert a customer web link to its JSON API form. Returns null if invalid. */
export function toApiUrl(rawLink: string): string | null {
  let url: URL;
  try {
    url = new URL(rawLink.trim());
  } catch {
    return null;
  }

  if (!ALLOWED_HOSTS.has(url.hostname)) return null;

  // Already an API link?  /api/c/<token>
  if (url.pathname.startsWith('/api/')) return url.toString();

  // Customer link /c/<token>  ->  /api/c/<token>
  if (url.pathname.startsWith('/c/')) {
    return `${url.origin}/api${url.pathname}${url.search}`;
  }

  return null;
}

/** True if a string looks like a supplier account link we can read. */
export function isNetflixLink(rawLink: string): boolean {
  return toApiUrl(rawLink) !== null;
}

/**
 * Pull a short numeric/alphanumeric code out of a message.
 * The panel had no live message to inspect, so we read the common shapes
 * defensively AND scan the text for a Netflix-style code as a fallback.
 */
/** Remove URLs so tracking ids inside links (e.g. "...-1234-...") can't pass as codes. */
function stripUrls(t: string): string {
  return t.replace(/\[?https?:\/\/[^\s\]]+\]?/gi, ' ');
}

/** Turn an email's HTML into plain text (fallback when there's no text part). */
function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
}

/**
 * Pull the code out of a message.
 *
 * The supplier now sends the WHOLE email (subject/text/html) rather than a
 * ready-made `code` field. Emails are full of other digits — tracking ids in
 * links, addresses, years — so we only accept a 4–8 digit number that sits
 * near the word "code", after stripping URLs. Household emails contain a link
 * instead of a number; for those this returns null and extractLink() applies.
 */
function extractCode(msg: any, strict = false): string | null {
  // A ready-made field, if the supplier ever sends one again.
  for (const k of ['code', 'otp', 'verificationCode', 'verification_code']) {
    const v = msg?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  const raw =
    typeof msg?.text === 'string' && msg.text.trim()
      ? msg.text
      : typeof msg?.body === 'string' && msg.body.trim()
      ? msg.body
      : typeof msg?.content === 'string' && msg.content.trim()
      ? msg.content
      : typeof msg?.html === 'string'
      ? htmlToText(msg.html)
      : '';
  const text = stripUrls(String(raw)).replace(/\s+/g, ' ');
  if (!text) return null;

  // "Enter this code to sign in 5329" / "Your code is 123456"
  const near = text.match(/code[^0-9]{0,80}?\b(\d{4,8})\b/i);
  if (near) return near[1];

  // Subject says it's a code email, but the wording differs: first number.
  // Skipped in strict mode (email has an action link) — there, any loose
  // number is noise like the ZIP code in Netflix's footer address.
  if (!strict && /code/i.test(String(msg?.subject ?? ''))) {
    const first = text.match(/\b(\d{4,8})\b/);
    if (first) return first[1];
  }
  return null;
}

/** Button labels that mark the action link in Netflix household / access emails. */
const ACTION_LABEL =
  /(get\s*code|yes,?\s*(it|this)\s*was\s*me|this\s*was\s*me|update\s*(netflix\s*)?household|confirm|verify|approve|send\s*(me\s*)?(the\s*)?code)/i;

function isNetflixUrl(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return u.startsWith('https://') && (h === 'netflix.com' || h.endsWith('.netflix.com'));
  } catch {
    return false;
  }
}

/**
 * Find the email's action button link (household / temporary-access emails).
 * Only https netflix.com links whose button text looks like an action are
 * accepted — never help, legal or "review activity" footer links.
 */
function extractLink(msg: any): { link: string; label: string } | null {
  const html = typeof msg?.html === 'string' ? msg.html : '';
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = m[1].replace(/&amp;/gi, '&').trim();
    const label = htmlToText(m[2]).trim();
    if (label && ACTION_LABEL.test(label) && isNetflixUrl(url)) {
      return { link: url, label };
    }
  }
  // Plain-text form: "Get Code [https://www.netflix.com/...]"
  const text = typeof msg?.text === 'string' ? msg.text : '';
  for (const m of text.matchAll(/([^\n\[\]]{2,60}?)\s*\[(https:\/\/[^\s\]]+)\]/g)) {
    const label = m[1].trim();
    if (ACTION_LABEL.test(label) && isNetflixUrl(m[2])) return { link: m[2], label };
  }
  return null;
}

/**
 * Find and parse the message's arrival time from whatever field the supplier
 * uses. We saw the panel render "13m ago", so a timestamp is present — this
 * reads the common field names and formats (epoch seconds, epoch millis, ISO
 * date string) and returns milliseconds since epoch, or null if none found.
 */
function parseTimestamp(msg: any): number | null {
  const candidates = [
    msg?.timestamp,
    msg?.date,
    msg?.createdAt,
    msg?.created_at,
    msg?.receivedAt,
    msg?.received_at,
    msg?.time,
    msg?.datetime,
    msg?.sentAt,
    msg?.sent_at,
  ];

  for (const c of candidates) {
    if (c == null) continue;

    if (typeof c === 'number' && Number.isFinite(c)) {
      // epoch seconds (10 digits) vs milliseconds (13 digits)
      return c < 1e12 ? c * 1000 : c;
    }

    if (typeof c === 'string') {
      const s = c.trim();
      if (!s) continue;

      // all-digit string → epoch
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        return n < 1e12 ? n * 1000 : n;
      }

      // ISO / parseable date string
      const parsed = Date.parse(s);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return null;
}

function mapMessage(msg: any): NetflixMessage {
  return {
    subject: msg?.subject ?? msg?.title ?? null,
    from: msg?.from ?? msg?.sender ?? null,
    ...(() => {
      const l = extractLink(msg);
      return {
        code: extractCode(msg, !!l),
        link: l?.link ?? null,
        linkLabel: l?.label ?? null,
      };
    })(),
    body: msg?.body ?? msg?.text ?? msg?.content ?? null,
    date: msg?.date ?? msg?.createdAt ?? msg?.created_at ?? msg?.receivedAt ?? null,
    timestamp: parseTimestamp(msg),
  };
}

/** Fetch the live panel for a stored supplier link. */
export async function fetchNetflixPanel(rawLink: string): Promise<NetflixPanel> {
  const apiUrl = toApiUrl(rawLink);
  if (!apiUrl) {
    return { ok: false, profile: null, messages: [], error: 'Invalid or unsupported account link.' };
  }

  try {
    const res = await fetch(apiUrl, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return { ok: false, profile: null, messages: [], error: `Supplier returned HTTP ${res.status}.` };
    }

    const json: any = await res.json();
    if (!json?.success || !json?.data) {
      return { ok: false, profile: null, messages: [], error: 'Supplier link is no longer active.' };
    }

    const p = json.data.profile ?? {};
    const rawMsgs: any[] = Array.isArray(json.data.messages) ? json.data.messages : [];

    // Log the shape of a real message the FIRST time one appears, so we can
    // tighten extractCode() against the true field names. Values are not logged.
    if (rawMsgs.length > 0) {
      console.log('[netflix] message keys seen:', Object.keys(rawMsgs[0]));
    }

    return {
      ok: true,
      profile: {
        email: p.email ?? null,
        password: p.password ?? null,
        name: p.name ?? null,
        pin: p.pin ?? null,
        endDate: p.endDate ?? p.end_date ?? null,
      },
      messages: rawMsgs.map(mapMessage),
    };
  } catch (err: any) {
    console.error('[netflix] fetch failed:', err);
    return { ok: false, profile: null, messages: [], error: 'Could not reach the supplier right now.' };
  }
}
