import { panelBase, requirePanelAdmin } from '@/lib/panel/auth';
import { listEmails } from '@/lib/panel/data';
import { Shell } from '../Shell';

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
