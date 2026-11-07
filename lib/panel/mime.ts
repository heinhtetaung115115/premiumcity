// lib/panel/mime.ts
// Minimal MIME parser for forwarded login-code emails: headers, multipart,
// base64 / quoted-printable, RFC 2047 encoded subjects, and forwarded
// messages attached as message/rfc822. Enough for service emails; not a
// general-purpose mail library.

export type ParsedEmail = {
  headers: Record<string, string[]>;
  subject: string;
  from: string;
  addresses: string[]; // every recipient-ish address we could find
  text: string;
  html: string;
};

type Part = { headers: Record<string, string[]>; body: string };

function splitHead(raw: string): Part {
  const m = raw.match(/\r?\n\r?\n/);
  const idx = m && m.index !== undefined ? m.index : raw.length;
  const head = raw.slice(0, idx);
  const body = m && m.index !== undefined ? raw.slice(idx + m[0].length) : '';
  const headers: Record<string, string[]> = {};
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const c = line.indexOf(':');
    if (c <= 0) continue;
    const name = line.slice(0, c).trim().toLowerCase();
    const value = line.slice(c + 1).trim();
    (headers[name] ||= []).push(value);
  }
  return { headers, body };
}

function param(header: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|([^;\\s]+))`, 'i');
  const m = header.match(re);
  return m ? (m[1] ?? m[2] ?? null) : null;
}

function decodeBytes(bytes: Buffer, charset: string | null): string {
  const cs = (charset || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(cs, { fatal: false }).decode(bytes);
  } catch {
    return bytes.toString('utf8');
  }
}

function qpToBuffer(s: string): Buffer {
  const cleaned = s.replace(/=\r?\n/g, '');
  const out: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
      out.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      out.push(...Buffer.from(ch, 'utf8'));
    }
  }
  return Buffer.from(out);
}

function decodeBody(body: string, cte: string, charset: string | null): string {
  const enc = cte.toLowerCase();
  if (enc === 'base64') return decodeBytes(Buffer.from(body.replace(/\s+/g, ''), 'base64'), charset);
  if (enc === 'quoted-printable') return decodeBytes(qpToBuffer(body), charset);
  // 7bit / 8bit / binary: the worker already handed us text
  return body;
}

/** RFC 2047: =?utf-8?B?...?= / =?utf-8?Q?...?= */
export function decodeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s+(?==\?))?/g, (_m, cs, enc, txt) => {
    try {
      if (enc.toUpperCase() === 'B') return decodeBytes(Buffer.from(txt, 'base64'), cs);
      return decodeBytes(qpToBuffer(txt.replace(/_/g, ' ')), cs);
    } catch {
      return txt;
    }
  });
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

function walk(part: Part, acc: ParsedEmail, depth: number) {
  if (depth > 6) return;
  const ct = (part.headers['content-type']?.[0] || 'text/plain').toString();
  const type = ct.split(';')[0].trim().toLowerCase();
  const cte = (part.headers['content-transfer-encoding']?.[0] || '7bit').trim();

  if (type.startsWith('multipart/')) {
    const boundary = param(ct, 'boundary');
    if (!boundary) return;
    const pieces = part.body.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?\\s*\\r?\\n?`));
    for (const piece of pieces) {
      if (!piece.trim()) continue;
      walk(splitHead(piece), acc, depth + 1);
    }
    return;
  }

  if (type === 'message/rfc822') {
    // Forwarded as an attachment: the original email is inside.
    const inner = splitHead(decodeBody(part.body, cte, null));
    collectAddresses(inner.headers, acc);
    if (!acc.subject && inner.headers['subject']) acc.subject = decodeWords(inner.headers['subject'][0]);
    walk(inner, acc, depth + 1);
    return;
  }

  const charset = param(ct, 'charset');
  if (type === 'text/plain' && !acc.text) acc.text = decodeBody(part.body, cte, charset);
  else if (type === 'text/html' && !acc.html) acc.html = decodeBody(part.body, cte, charset);
}

function collectAddresses(headers: Record<string, string[]>, acc: ParsedEmail) {
  for (const h of ['to', 'cc', 'delivered-to', 'x-original-to', 'x-forwarded-to', 'x-forwarded-for', 'resent-to', 'envelope-to']) {
    for (const v of headers[h] ?? []) {
      for (const m of v.match(EMAIL_RE) ?? []) acc.addresses.push(m.toLowerCase());
    }
  }
}

export function parseEmail(raw: string, envelopeTo?: string | null): ParsedEmail {
  const top = splitHead(raw);
  const acc: ParsedEmail = {
    headers: top.headers,
    subject: decodeWords(top.headers['subject']?.[0] || ''),
    from: decodeWords(top.headers['from']?.[0] || ''),
    addresses: [],
    text: '',
    html: '',
  };
  collectAddresses(top.headers, acc);
  if (envelopeTo) acc.addresses.push(envelopeTo.toLowerCase());
  walk(top, acc, 0);

  // Outlook "Forward" (not Redirect) puts the original To: line in the body.
  const bodyText = acc.text || acc.html.replace(/<[^>]+>/g, ' ');
  for (const m of bodyText.match(/^\s*(?:To|Para|Sent to)\s*:\s*.*$/gim) ?? []) {
    for (const e of m.match(EMAIL_RE) ?? []) acc.addresses.push(e.toLowerCase());
  }
  acc.addresses = Array.from(new Set(acc.addresses));
  return acc;
}

/** Gmail ignores dots and +tags; compare addresses the way the mailbox does. */
export function normalizeEmail(e: string): string {
  const [local, domain] = e.trim().toLowerCase().split('@');
  if (!domain) return e.trim().toLowerCase();
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return `${local.split('+')[0].replace(/\./g, '')}@gmail.com`;
  }
  return `${local.split('+')[0]}@${domain}`;
}
