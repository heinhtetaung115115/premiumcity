// lib/netflix.ts
// Reads a reseller "account panel" link and returns the live account data.
//
// HOW THE LINK WORKS (discovered by inspecting the panel):
//   The customer-facing page is:   https://resellerpanel.store/c/<token>
//   Its data comes from a JSON API: https://resellerpanel.store/api/c/<token>
//   i.e. the SAME url with "/api" inserted before the path.
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
};

export type NetflixPanel = {
  ok: boolean;
  profile: NetflixProfile | null;
  messages: NetflixMessage[];
  error?: string;
};

/** Only allow links from the known supplier host — never fetch arbitrary URLs. */
const ALLOWED_HOSTS = new Set(['resellerpanel.store', 'www.resellerpanel.store']);

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
function extractCode(msg: any): string | null {
  // direct fields the API might use
  for (const k of ['code', 'otp', 'verificationCode', 'verification_code']) {
    const v = msg?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  // otherwise scan subject/body/text for a 4-8 digit code or a 6-char token
  const text = [msg?.subject, msg?.body, msg?.text, msg?.content, msg?.html]
    .filter((x) => typeof x === 'string')
    .join(' ');
  const m = text.match(/\b(\d{4,8})\b/) || text.match(/\b([A-Z0-9]{6})\b/);
  return m ? m[1] : null;
}

function mapMessage(msg: any): NetflixMessage {
  return {
    subject: msg?.subject ?? msg?.title ?? null,
    from: msg?.from ?? msg?.sender ?? null,
    code: extractCode(msg),
    body: msg?.body ?? msg?.text ?? msg?.content ?? null,
    date: msg?.date ?? msg?.createdAt ?? msg?.created_at ?? msg?.receivedAt ?? null,
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
