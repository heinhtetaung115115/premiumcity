import Link from 'next/link';
import { notFound } from 'next/navigation';
import { panelBase, requirePanelAdmin } from '@/lib/panel/auth';
import { getAccount, linkIsLive, listEmails, listLinks } from '@/lib/panel/data';
import { customerLinkUrl } from '@/lib/panel/config';
import { SERVICES, serviceInfo } from '@/lib/panel/rules';
import {
  changePasswordAction,
  createLinkAction,
  extendLinkAction,
  revokeLinkAction,
  updateAccountAction,
  updateLinkProfileAction,
} from '../../actions';
import { Shell, btnCls, cardCls, inputCls, labelCls } from '../../Shell';
import { CopyBtn } from '../../CopyBtn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fmt(iso: string | null, withTime = false) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Asia/Yangon',
  });
}
function dateValue(iso: string | null) {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 6.5 * 3600_000).toISOString().slice(0, 10);
}

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | undefined>;
}) {
  requirePanelAdmin();
  const base = panelBase();
  const acc = await getAccount(params.id);
  if (!acc) notFound();
  const [links, mails] = await Promise.all([listLinks(acc.id), listEmails({ accountId: acc.id, limit: 30 })]);
  const svc = serviceInfo(acc.service);
  const sp = searchParams ?? {};
  const newLink = sp.new ? links.find((l) => l.token === sp.new) : null;

  const flash =
    sp.ok === 'pw'
      ? `Password updated. Emails sent: ${sp.sent ?? 0}${Number(sp.failed) ? `, failed: ${sp.failed}` : ''}.`
      : sp.ok === 'saved'
      ? 'Saved.'
      : sp.ok === 'extended'
      ? 'Link extended.'
      : sp.ok === 'revoked'
      ? 'Link revoked.'
      : sp.ok === 'profile'
      ? 'Customer / profile saved.'
      : sp.e === 'same'
      ? 'That is already the password.'
      : sp.e === 'pw'
      ? 'Enter a new password.'
      : null;

  return (
    <Shell base={base} active="accounts">
      <Link href={`${base}/admin`} className="text-xs text-slate-500 hover:text-slate-300">
        ← Accounts
      </Link>
      <div className="mb-5 mt-2 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-base font-black text-white" style={{ background: svc.color === '#ffffff' ? '#334155' : svc.color }}>
          {svc.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-white">{acc.email}</h1>
          <p className="text-xs text-slate-500">
            {svc.name} · password updated {fmt(acc.password_updated_at, true)}
          </p>
        </div>
      </div>

      {flash && <p className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-200">{flash}</p>}

      {(() => {
        const liveLinks = links.filter((l) => linkIsLive(l));
        const max = acc.max_profiles ?? 5;
        const free = Math.max(0, max - liveLinks.length);
        return (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Profiles</p>
              <p className={`text-xs font-semibold ${free === 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {liveLinks.length}/{max} used · {free} free
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-5">
              {Array.from({ length: max }, (_, i) => {
                const l = liveLinks[i];
                const d = l ? Math.ceil((new Date(l.warranty_until).getTime() - Date.now()) / 86_400_000) : 0;
                return (
                  <div
                    key={i}
                    className={`rounded-xl border px-3 py-2 text-xs ${
                      l ? 'border-indigo-400/30 bg-indigo-500/[0.08]' : 'border-dashed border-white/10 text-slate-600'
                    }`}
                  >
                    {l ? (
                      <>
                        <p className="truncate font-semibold text-white">{l.profile_name || `Profile ${i + 1}`}</p>
                        <p className="truncate text-slate-400">{l.customer_name || 'Customer'}</p>
                        <p className={d <= 3 ? 'text-amber-300' : 'text-slate-500'}>{d}d left</p>
                      </>
                    ) : (
                      <p className="py-2 text-center">Free</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {newLink && (
        <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
          <p className="text-sm font-semibold text-emerald-200">Link created — send it to the customer:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all text-sm text-white">{customerLinkUrl(newLink.token)}</code>
            <CopyBtn value={customerLinkUrl(newLink.token)} label="Copy link" />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Password */}
        <section className={cardCls}>
          <h2 className="mb-1 text-sm font-semibold text-white">Password</h2>
          <div className="mb-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/30 px-3 py-2 text-sm text-white">{acc.password || '—'}</code>
            <CopyBtn value={acc.password} />
          </div>
          <form action={changePasswordAction} className="space-y-2">
            <input type="hidden" name="id" value={acc.id} />
            <input name="password" placeholder="New password" className={inputCls} autoComplete="off" />
            <textarea name="note" rows={2} placeholder="Note for customers (optional)" className={inputCls} />
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" name="notify" defaultChecked /> Email customers who have an email on their link
            </label>
            <button className={btnCls}>Update password</button>
          </form>
        </section>

        {/* New link */}
        <section className={cardCls}>
          <h2 className="mb-3 text-sm font-semibold text-white">New customer link</h2>
          <form action={createLinkAction} className="space-y-2">
            <input type="hidden" name="accountId" value={acc.id} />
            <div className="grid grid-cols-2 gap-2">
              <input name="profileName" placeholder="Profile name (e.g. Aung)" className={inputCls} />
              <input name="profilePin" placeholder="Profile PIN (optional)" className={inputCls} />
            </div>
            <input name="customerName" placeholder="Customer name (e.g. Ko Aung · Viber)" className={inputCls} />
            <input name="customerEmail" type="email" placeholder="Customer email (optional — for password emails)" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className={labelCls}>Warranty days</span>
                <input name="days" type="number" min={1} max={730} defaultValue={30} className={inputCls} />
              </label>
              <label>
                <span className={labelCls}>…or until date</span>
                <input name="until" type="date" className={inputCls} />
              </label>
            </div>
            <button className={btnCls}>Create link</button>
          </form>
        </section>
      </div>

      {/* Links */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-white">Customer links ({links.length})</h2>
        {links.length === 0 && <p className="text-sm text-slate-500">No links yet.</p>}
        <div className="space-y-2">
          {links.map((l) => {
            const live = linkIsLive(l);
            const days = Math.ceil((new Date(l.warranty_until).getTime() - Date.now()) / 86_400_000);
            return (
              <div key={l.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {l.profile_name && (
                        <span className="mr-1.5 rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[11px] text-indigo-200">
                          👤 {l.profile_name}
                        </span>
                      )}
                      {l.customer_name || 'Customer'}
                      {l.customer_email && <span className="font-normal text-slate-500"> · {l.customer_email}</span>}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Until {fmt(l.warranty_until)} · last opened {l.last_viewed_at ? fmt(l.last_viewed_at, true) : 'never'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      live ? (days <= 3 ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-400/15 text-emerald-300') : 'bg-white/5 text-slate-500'
                    }`}
                  >
                    {live ? `${days}d left` : l.status === 'revoked' ? 'Revoked' : 'Expired'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyBtn value={customerLinkUrl(l.token)} label="Copy link" />
                  <a href={`${base}/c/${l.token}`} target="_blank" className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5">
                    Open
                  </a>
                  <form action={extendLinkAction} className="flex items-center gap-1">
                    <input type="hidden" name="linkId" value={l.id} />
                    <input type="hidden" name="accountId" value={acc.id} />
                    <input type="hidden" name="currentUntil" value={l.warranty_until} />
                    <input name="days" type="number" min={1} defaultValue={30} className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white" />
                    <button className="rounded-lg border border-emerald-400/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/10">
                      + days
                    </button>
                  </form>
                  <details className="w-full sm:w-auto">
                    <summary className="cursor-pointer rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5">
                      Edit profile / customer
                    </summary>
                    <form action={updateLinkProfileAction} className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="linkId" value={l.id} />
                      <input type="hidden" name="accountId" value={acc.id} />
                      <input name="profileName" defaultValue={l.profile_name ?? ''} placeholder="Profile name" className={inputCls} />
                      <input name="profilePin" defaultValue={l.profile_pin ?? ''} placeholder="Profile PIN" className={inputCls} />
                      <input name="customerName" defaultValue={l.customer_name ?? ''} placeholder="Customer name" className={inputCls} />
                      <input name="customerEmail" defaultValue={l.customer_email ?? ''} placeholder="Customer email" className={inputCls} />
                      <button className={`${btnCls} sm:col-span-2`}>Save</button>
                    </form>
                  </details>
                  {l.status === 'active' && (
                    <form action={revokeLinkAction}>
                      <input type="hidden" name="linkId" value={l.id} />
                      <input type="hidden" name="accountId" value={acc.id} />
                      <button className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-400 hover:border-rose-400/50 hover:text-rose-300">
                        Revoke
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Emails */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-white">Recent emails for this account</h2>
        {mails.length === 0 && (
          <p className="text-sm text-slate-500">None yet. Set up forwarding from this mailbox to codes@pcity.online.</p>
        )}
        <div className="space-y-1.5">
          {mails.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
              <span className={`rounded px-1.5 py-0.5 font-semibold ${m.verdict === 'allowed' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                {m.verdict === 'allowed' ? 'Shown' : 'Hidden'}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-200">{m.subject}</span>
              {m.code && <code className="text-white">{m.code}</code>}
              <span className="flex-shrink-0 text-slate-500">{fmt(m.received_at, true)}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Edit account */}
      <details className={`${cardCls} mt-6`}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">Edit account details</summary>
        <form action={updateAccountAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={acc.id} />
          <label>
            <span className={labelCls}>Service</span>
            <select name="service" defaultValue={acc.service} className={inputCls}>
              {Object.entries(SERVICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Email</span>
            <input name="email" defaultValue={acc.email} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Profiles on this account</span>
            <input name="maxProfiles" type="number" min={1} max={20} defaultValue={acc.max_profiles ?? 5} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Account ends</span>
            <input name="accountExpires" type="date" defaultValue={dateValue(acc.account_expires_at)} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Supplier</span>
            <input name="supplier" defaultValue={acc.supplier ?? ''} className={inputCls} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelCls}>Notes</span>
            <input name="notes" defaultValue={acc.notes ?? ''} className={inputCls} />
          </label>
          <label>
            <span className={labelCls}>Status</span>
            <select name="status" defaultValue={acc.status} className={inputCls}>
              <option value="active">Active</option>
              <option value="archived">Archived (all links stop)</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className={btnCls}>Save</button>
          </div>
        </form>
      </details>
    </Shell>
  );
}
