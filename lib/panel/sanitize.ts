// lib/panel/sanitize.ts
// Make a service email safe to show to customers in full:
//  - no scripts, iframes, forms or event handlers (it's also rendered in a
//    sandboxed iframe with scripts disabled)
//  - links that could lock/reset the shared account ("This was NOT me",
//    "click here", password/reset, email change…) or that point outside the
//    service's own domain are turned into plain, unclickable text
//  - remaining links open in a new tab

const DANGER =
  /(not me|wasn'?t (?:me|you)|click here|secure your|password|reset|recover|change (?:your )?e-?mail|e-?mail change|update (?:your )?e-?mail|unsubscribe|cancel|delete|account settings|manage|preferences)/i;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function allowedHost(url: string, senders: string[]): boolean {
  try {
    const h = new URL(url.replace(/&amp;/g, '&')).hostname.toLowerCase();
    if (!senders.length) return false;
    return senders.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function safeLink(url: string, label: string, senders: string[]): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  if (!allowedHost(url, senders)) return false;
  if (DANGER.test(label)) return false;
  return true;
}

export function sanitizeEmailHtml(html: string, senders: string[]): string {
  let h = html
    // paired tags with their content first, then any leftover single tags
    .replace(/<(script|iframe|object|embed|form|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|iframe|object|embed|form|base|meta|link|noscript)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_m, attrs: string, inner: string) => {
    const href = (attrs.match(/href\s*=\s*["']([^"']+)["']/i) || [])[1] || '';
    const label = textOf(inner);
    if (!safeLink(href, label, senders)) {
      // Keep the look of the button but make it dead.
      return `<span style="opacity:.45;cursor:not-allowed" title="Disabled for account safety">${inner}</span>`;
    }
    const cleanAttrs = attrs.replace(/\starget\s*=\s*["'][^"']*["']/gi, '').replace(/\srel\s*=\s*["'][^"']*["']/gi, '');
    return `<a${cleanAttrs} target="_blank" rel="noopener noreferrer">${inner}</a>`;
  });
  return h;
}

/** Plain-text email → simple HTML; safe links become buttons, dangerous ones disappear. */
export function textEmailToSafeHtml(text: string, senders: string[]): string {
  // Drop the quoted "From / Sent / To / Subject" block of a forward.
  let t = text;
  const subj = t.search(/^\s*Subject\s*:.*$/im);
  if (subj >= 0) t = t.slice(subj).replace(/^\s*Subject\s*:.*$/im, '');
  t = t.replace(/_{5,}/g, '');

  const out: string[] = [];
  for (const line of t.split(/\r?\n/)) {
    let html = '';
    let last = 0;
    const re = /[<\[(]?\s*(https?:\/\/[^\s<>"')\]]+)\s*[>\])]?/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const before = line.slice(last, m.index);
      const label = before.replace(/[:\-–|]+\s*$/, '').trim().split(/\s{2,}/).pop() || '';
      html += esc(before);
      const url = m[1];
      if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)) {
        // image placeholder from a text email: drop it
      } else if (label && safeLink(url, label, senders)) {
        html += ` <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:4px 0;padding:8px 14px;border-radius:8px;background:#f47521;color:#fff;font-weight:700;text-decoration:none">Open ↗</a>`;
      }
      last = m.index + m[0].length;
    }
    html += esc(line.slice(last));
    out.push(html);
  }
  const body = out.join('<br>').replace(/(<br>\s*){3,}/g, '<br><br>');
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;padding:16px">${body}</div>`;
}

/** Best safe full view for an email. */
export function safeEmailView(htmlBody: string | null, textBody: string | null, senders: string[]): string {
  if (htmlBody && htmlBody.trim().length > 40) return sanitizeEmailHtml(htmlBody, senders);
  return textEmailToSafeHtml(textBody || '', senders);
}
