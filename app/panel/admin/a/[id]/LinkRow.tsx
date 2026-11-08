import { customerLinkUrl } from '@/lib/panel/config';
import type { PanelLink } from '@/lib/panel/data';
import { linkIsLive } from '@/lib/panel/data';
import {
  deleteLinkAction,
  extendLinkAction,
  revokeLinkAction,
  setLinkUntilAction,
  updateLinkProfileAction,
} from '../../actions';
import { CopyBtn } from '../../CopyBtn';
import { btnCls, inputCls } from '../../Shell';

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
function dateValue(iso: string) {
  return new Date(new Date(iso).getTime() + 6.5 * 3600_000).toISOString().slice(0, 10);
}

const chip =
  'rounded-lg border border-emerald-400/30 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-400/10';
const ghost = 'cursor-pointer list-none rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5';

export function LinkRow({ l, accountId, base }: { l: PanelLink; accountId: string; base: string }) {
  const live = linkIsLive(l);
  const days = Math.ceil((new Date(l.warranty_until).getTime() - Date.now()) / 86_400_000);
  const hidden = (
    <>
      <input type="hidden" name="linkId" value={l.id} />
      <input type="hidden" name="accountId" value={accountId} />
    </>
  );

  return (
    <div className={`rounded-2xl border p-3 ${live ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 bg-white/[0.015] opacity-80'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {l.profile_name && (
              <span className="mr-1.5 rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[11px] text-indigo-200">👤 {l.profile_name}</span>
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

      <div className="mt-2 flex flex-wrap items-start gap-2">
        {live && <CopyBtn value={customerLinkUrl(l.token)} label="Copy link" />}
        {live && (
          <a href={`${base}/c/${l.token}`} target="_blank" className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-white/5">
            Open
          </a>
        )}

        {/* Change expiry */}
        <details className="group">
          <summary className={ghost}>📅 {live ? 'Change expiry' : 'Renew'} ▾</summary>
          <div className="mt-2 space-y-2 rounded-xl border border-white/10 bg-black/30 p-3">
            <p className="text-[11px] text-slate-400">Add days {live ? 'to the current end date' : 'from today'}</p>
            <div className="flex flex-wrap gap-1.5">
              {[7, 15, 30, 90].map((d) => (
                <form key={d} action={extendLinkAction}>
                  {hidden}
                  <input type="hidden" name="currentUntil" value={l.warranty_until} />
                  <input type="hidden" name="days" value={d} />
                  <button className={chip}>+{d}d</button>
                </form>
              ))}
            </div>
            <form action={setLinkUntilAction} className="flex items-center gap-2">
              {hidden}
              <input name="until" type="date" defaultValue={dateValue(l.warranty_until)} className={`${inputCls} py-1 text-xs`} />
              <button className="rounded-lg bg-indigo-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-400">Set date</button>
            </form>
            <p className="text-[10px] text-slate-500">Set date can also shorten it.</p>
          </div>
        </details>

        {/* Edit profile / customer */}
        <details>
          <summary className={ghost}>✏️ Edit ▾</summary>
          <form action={updateLinkProfileAction} className="mt-2 grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
            {hidden}
            <input name="profileName" defaultValue={l.profile_name ?? ''} placeholder="Profile name" className={inputCls} />
            <input name="profilePin" defaultValue={l.profile_pin ?? ''} placeholder="Profile PIN" className={inputCls} />
            <input name="customerName" defaultValue={l.customer_name ?? ''} placeholder="Customer name" className={inputCls} />
            <input name="customerEmail" defaultValue={l.customer_email ?? ''} placeholder="Customer email" className={inputCls} />
            <button className={`${btnCls} sm:col-span-2`}>Save</button>
          </form>
        </details>

        {live ? (
          <details>
            <summary className={`${ghost} hover:border-rose-400/50 hover:text-rose-300`}>Revoke</summary>
            <form action={revokeLinkAction} className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
              {hidden}
              <p className="mb-2 text-[11px] text-rose-200">The customer loses access now. The profile slot becomes free.</p>
              <button className="rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white">Yes, revoke</button>
            </form>
          </details>
        ) : (
          <details>
            <summary className={`${ghost} hover:border-rose-400/50 hover:text-rose-300`}>🗑 Delete</summary>
            <form action={deleteLinkAction} className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
              {hidden}
              <p className="mb-2 text-[11px] text-rose-200">Delete this link forever?</p>
              <button className="rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white">Yes, delete</button>
            </form>
          </details>
        )}
      </div>
    </div>
  );
}
