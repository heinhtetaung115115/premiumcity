import { panelBase, requirePanelAdmin } from '@/lib/panel/auth';
import { listEmails } from '@/lib/panel/data';
import { Shell } from '../Shell';
import { htmlToText } from '@/lib/panel/rules';

/** Every button/link in the email with its text, so admin can see which one customers get. */
function linksOf(html: string | null): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const m of (html || '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
    if (!/^https?:/i.test(m[1])) continue;
    out.push({ label: label || (/<img/i.test(m[2]) ? '(image)' : '(no text)'), url: m[1].replace(/&amp;/g, '&') });
  }
  return out.slice(0, 15);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yangon' });
}

export default async function InboxPage() {
  requirePanelAdmin();
  const base = panelBase();
  let mails: Awaited<ReturnType<typeof listEmails>> = [];
  try {
    mails = await listEmails({ limit: 150 });
  } catch {
    mails = [];
  }
  return (
    <Shell base={base} active="inbox">
      <h1 className="text-xl font-semibold text-white">Inbox</h1>
      <p className="mb-4 text-xs text-slate-500">
        Every email forwarded to codes@pcity.online. Customers only see the ones marked “Shown”. Gmail forwarding
        confirmation codes appear here too.
      </p>
      {mails.length === 0 && <p className="text-sm text-slate-500">Nothing received yet.</p>}
      <div className="space-y-2">
        {mails.map((m) => (
          <details key={m.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <summary className="flex cursor-pointer items-center gap-3 text-xs">
              <span
                className={`rounded px-1.5 py-0.5 font-semibold ${
                  m.verdict === 'allowed' ? 'bg-emerald-400/15 text-emerald-300' : m.account_id ? 'bg-rose-400/10 text-rose-300' : 'bg-amber-400/10 text-amber-300'
                }`}
              >
                {m.verdict === 'allowed' ? 'Shown' : m.account_id ? 'Hidden' : 'No account'}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-100">{m.subject || '(no subject)'}</span>
              {m.code && <code className="font-bold text-white">{m.code}</code>}
              <span className="flex-shrink-0 text-slate-500">{fmt(m.received_at)}</span>
            </summary>
            <div className="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-slate-400">
              <p>
                <b className="text-slate-300">From:</b> {m.from_address}
              </p>
              <p className="break-all">
                <b className="text-slate-300">To:</b> {m.to_addresses}
              </p>
              <p>
                <b className="text-slate-300">Why:</b> {m.reason}
              </p>
              {m.action_link && (
                <p className="break-all">
                  <b className="text-slate-300">Link:</b> {m.action_link}
                </p>
              )}
              {linksOf(m.html_body).length > 0 && (
                <div className="mt-2 rounded-xl border border-white/5 p-2">
                  <p className="mb-1 font-semibold text-slate-300">Links in this email</p>
                  {linksOf(m.html_body).map((l, i) => {
                    const chosen = !!m.action_link && l.url === m.action_link;
                    return (
                      <p key={i} className="flex gap-2 py-0.5">
                        <span className={chosen ? 'text-emerald-300' : 'text-slate-600'}>{chosen ? '✅' : '⛔'}</span>
                        <span className={chosen ? 'font-semibold text-emerald-200' : 'text-slate-400'}>{l.label}</span>
                        <span className="truncate text-slate-600">{l.url.slice(0, 60)}…</span>
                      </p>
                    );
                  })}
                  <p className="mt-1 text-[10px] text-slate-500">✅ = the button customers get · ⛔ = never shown</p>
                </div>
              )}
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 text-[11px] text-slate-300">
                {(m.text_body || '').slice(0, 4000)}
              </pre>
            </div>
          </details>
        ))}
      </div>
    </Shell>
  );
}
