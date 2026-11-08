import Link from 'next/link';
import { notFound } from 'next/navigation';
import { panelBase, requirePanelAdmin } from '@/lib/panel/auth';
import { countLiveLinksByAccount, getAccount, linkIsLive, listAccounts, listEmails, listLinks } from '@/lib/panel/data';
import { customerLinkUrl } from '@/lib/panel/config';
import { SERVICES, serviceInfo } from '@/lib/panel/rules';
import {
  changePasswordAction,
  createLinkAction,
  deleteAccountAction,
  moveCustomersAction,
  updateAccountAction,
} from '../../actions';
import { Shell, btnCls, cardCls, inputCls, labelCls } from '../../Shell';
import { CopyBtn } from '../../CopyBtn';
import { LinkRow } from './LinkRow';

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
  const [links, mails, allAccounts, liveByAcc] = await Promise.all([
    listLinks(acc.id),
    listEmails({ accountId: acc.id, limit: 30 }),
    listAccounts(),
    countLiveLinksByAccount(),
  ]);
  const moveTargets = allAccounts.filter((a) => a.id !== acc.id && a.status === 'active' && a.service === acc.service);
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
      : sp.ok === 'deleted'
      ? 'Link deleted.'
      : sp.ok === 'moved'
      ? `Moved ${sp.n ?? 0} customer(s) here. Their links now show this account's email and password.`
      : sp.e === 'move'
      ? 'Pick another account to move customers to.'
      : sp.ok === 'date'
      ? 'End date changed.'
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
      {(() => {
        const active = links.filter((l) => linkIsLive(l));
        const ended = links.filter((l) => !linkIsLive(l));
        return (
          <>
            <section className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-white">Active customers ({active.length})</h2>
              {active.length === 0 && <p className="text-sm text-slate-500">No active customers.</p>}
              <div className="space-y-2">
                {active.map((l) => (
                  <LinkRow key={l.id} l={l} accountId={acc.id} base={base} />
                ))}
              </div>
            </section>
            {ended.length > 0 && (
              <details className="mt-4 rounded-2xl border border-white/5 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-400">
                  Ended — expired or revoked ({ended.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {ended.map((l) => (
                    <LinkRow key={l.id} l={l} accountId={acc.id} base={base} />
                  ))}
                </div>
              </details>
            )}
          </>
        );
      })()}

      {/* Account blocked? move customers */}
      {links.some((l) => linkIsLive(l)) && (
        <details className={`${cardCls} mt-6`}>
          <summary className="cursor-pointer text-sm font-semibold text-amber-300">
            ⚠️ Account blocked or broken? Move customers to another account
          </summary>
          {moveTargets.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">
              Add another {svc.name} account first (Accounts → Add account), then come back here.
            </p>
          ) : (
            <form action={moveCustomersAction} className="mt-3 space-y-2">
              <input type="hidden" name="fromId" value={acc.id} />
              <p className="text-xs text-slate-400">
                All {links.filter((l) => linkIsLive(l)).length} active customers keep the <b>same link</b>, profile name and expiry —
                their page just shows the new account’s email and password. Create their profiles on the new account in
                Crunchyroll too.
              </p>
              <select name="toId" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  Move to…
                </option>
                {moveTargets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email} — {liveByAcc[a.id] ?? 0}/{a.max_profiles ?? 5} profiles used
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" name="archiveOld" defaultChecked /> Archive this old account after moving
              </label>
              <button className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-400">
                Move customers
              </button>
            </form>
          )}
        </details>
      )}

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
        <details className="mt-5 border-t border-white/5 pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-rose-300">🗑 Delete this account</summary>
          <form action={deleteAccountAction} className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
            <input type="hidden" name="id" value={acc.id} />
            <p className="mb-2 text-xs text-rose-200">
              Deletes the account and ALL its customer links ({links.length}). Customers lose access immediately. This cannot be
              undone. To keep the history instead, set Status to Archived.
            </p>
            <label className="mb-2 flex items-center gap-2 text-xs text-rose-100">
              <input type="checkbox" name="confirm" required /> I understand
            </label>
            <button className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-bold text-white">Delete account</button>
          </form>
        </details>
      </details>
    </Shell>
  );
}
