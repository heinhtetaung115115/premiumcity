'use client';

import { useState } from 'react';

type Result = { ok: boolean; error?: string; message?: string; link?: string; key?: string };

const input =
  'w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500';

function useAction(action: (fd: FormData) => Promise<Result>) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  async function run(fd: FormData) {
    setBusy(true);
    setRes(null);
    try {
      setRes(await action(fd));
    } catch {
      setRes({ ok: false, error: 'Request failed — try again.' });
    } finally {
      setBusy(false);
    }
  }
  return { busy, res, run };
}

function ResultLine({ res }: { res: Result | null }) {
  if (!res) return null;
  return (
    <p className={`mt-2 text-xs ${res.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
      {res.ok ? res.message || 'Done.' : res.error}
    </p>
  );
}

function Copy({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="rounded border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-emerald-400"
    >
      {done ? 'Copied' : label}
    </button>
  );
}

export { Copy as CopyButton };

// ── Add server ─────────────────────────────────────────

export function AddServerForm({ action }: { action: (fd: FormData) => Promise<Result> }) {
  const { busy, res, run } = useAction(action);
  return (
    <form action={run} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <input name="name" placeholder="Name e.g. JP-DEC" className={input} required />
        <input name="country" placeholder="Country code e.g. JP" className={input} required maxLength={2} />
        <label className="block">
          <input name="paidUntil" type="date" className={input} title="Paid until" />
        </label>
      </div>
      <input
        name="apiUrl"
        placeholder='API URL from Outline Manager, e.g. https://1.2.3.4:12345/AbCdEf'
        className={input}
        required
      />
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" name="isBackup" />
        Backup server (stays empty; customers move here only when the main server is down)
      </label>
      <button
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? 'Checking server…' : 'Add server'}
      </button>
      <ResultLine res={res} />
    </form>
  );
}

// ── Per-server controls ────────────────────────────────

export function ServerControls({
  serverId,
  paidUntil,
  acceptingNew,
  isActive,
  isBackup,
  activeCustomers,
  otherServers,
  updateAction,
  moveAction,
}: {
  serverId: string;
  paidUntil: string | null;
  acceptingNew: boolean;
  isActive: boolean;
  isBackup: boolean;
  activeCustomers: number;
  otherServers: { id: string; label: string }[];
  updateAction: (fd: FormData) => Promise<Result>;
  moveAction: (fd: FormData) => Promise<Result>;
}) {
  const upd = useAction(updateAction);
  const mv = useAction(moveAction);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <form action={upd.run} className="flex items-end gap-2">
          <input type="hidden" name="serverId" value={serverId} />
          <label className="block">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Paid until</span>
            <input name="paidUntil" type="date" defaultValue={paidUntil ?? ''} className={input} />
          </label>
          <button disabled={upd.busy} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400">
            Save
          </button>
        </form>
        <form action={upd.run}>
          <input type="hidden" name="serverId" value={serverId} />
          <input type="hidden" name="isBackup" value={String(!isBackup)} />
          <button disabled={upd.busy} className="rounded-lg border border-sky-500/40 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/10">
            {isBackup ? 'Make main (not backup)' : 'Make backup'}
          </button>
        </form>
        <form action={upd.run}>
          <input type="hidden" name="serverId" value={serverId} />
          <input type="hidden" name="acceptingNew" value={String(!acceptingNew)} />
          <button disabled={upd.busy} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-emerald-400">
            {acceptingNew ? 'Stop new sales here' : 'Allow new sales here'}
          </button>
        </form>
        <form action={upd.run}>
          <input type="hidden" name="serverId" value={serverId} />
          <input type="hidden" name="isActive" value={String(!isActive)} />
          <button disabled={upd.busy} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 hover:border-rose-400 hover:text-rose-300">
            {isActive ? 'Switch off' : 'Switch on'}
          </button>
        </form>
      </div>
      <ResultLine res={upd.res} />

      {otherServers.length === 0 && activeCustomers > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-400">
          <p className="font-semibold text-slate-200">Move all {activeCustomers} customers to another server</p>
          <p className="mt-1">
            No other server is <b className="text-emerald-300">On</b> to move to. Add next month&apos;s server below
            (it starts On), or press <b>Switch on</b> on another server — then the Move button appears here.
          </p>
        </div>
      )}

      {otherServers.length > 0 && activeCustomers > 0 && (
        <form action={mv.run} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] p-3">
          <input type="hidden" name="fromServerId" value={serverId} />
          <p className="text-xs font-semibold text-amber-200">
            Move all {activeCustomers} customer{activeCustomers > 1 ? 's' : ''} to another server
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Same expiry, remaining data carried over. Customers using the main (ssconf) key don&apos;t need to do anything.
          </p>
          <div className="mt-2 flex gap-2">
            <select name="toServerId" className={input} required defaultValue="">
              <option value="" disabled>
                Move to…
              </option>
              {otherServers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            {!confirm ? (
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="whitespace-nowrap rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                Move all
              </button>
            ) : (
              <button
                disabled={mv.busy}
                className="whitespace-nowrap rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white hover:bg-rose-400 disabled:opacity-60"
              >
                {mv.busy ? 'Moving… (keep page open)' : 'Confirm move'}
              </button>
            )}
          </div>
          <ResultLine res={mv.res} />
        </form>
      )}
    </div>
  );
}

// ── Manual key for Viber / Telegram customers ──────────

export function CreateManualKeyForm({
  action,
  servers,
}: {
  action: (fd: FormData) => Promise<Result>;
  servers: { id: string; label: string; country: string }[];
}) {
  const { busy, res, run } = useAction(action);
  const [dataGb, setDataGb] = useState('100');
  const [length, setLength] = useState('1');
  const [unit, setUnit] = useState<'months' | 'days'>('months');

  const n = Math.max(0, Math.floor(Number(length) || 0));
  const days = unit === 'days' ? n : n * 30;
  const gb = Number(dataGb) || 0;
  const ends = days > 0 ? fmtDay(new Date(Date.now() + days * 86_400_000)) : '—';

  return (
    <form action={run} className="space-y-2">
      <input name="note" placeholder="Customer (e.g. Ko Aung · Viber 09xxxx)" className={input} required />
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Total data (GB, 0 = unlimited)</span>
          <input
            name="dataGb"
            type="number"
            min={0}
            step="1"
            value={dataGb}
            onChange={(e) => setDataGb(e.target.value)}
            className={input}
          />
        </label>
        <div className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Length</span>
          <div className="flex gap-1.5">
            <input
              name="length"
              type="number"
              min={1}
              max={unit === 'days' ? 730 : 24}
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className={`${input} w-16`}
            />
            <div className="flex overflow-hidden rounded-lg border border-slate-700">
              {(['days', 'months'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-2.5 text-xs font-semibold ${
                    unit === u ? 'bg-emerald-500 text-slate-950' : 'bg-slate-950 text-slate-300 hover:text-white'
                  }`}
                >
                  {u === 'days' ? 'Days' : 'Months'}
                </button>
              ))}
            </div>
            <input type="hidden" name="unit" value={unit} />
          </div>
        </div>
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Server</span>
          <select name="serverId" className={input} defaultValue="">
            <option value="">Auto (newest server)</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-slate-400">
        Customer gets{' '}
        <b className="text-slate-200">{gb > 0 ? `${gb} GB in total` : 'unlimited data'}</b> for{' '}
        <b className="text-slate-200">
          {n} {unit === 'days' ? (n === 1 ? 'day' : 'days') : n === 1 ? 'month' : 'months'}
        </b>{' '}
        · ends <b className="text-slate-200">{ends}</b> · no monthly reset
      </p>
      <input name="planName" placeholder="Plan name (optional, e.g. Japan 600GB)" className={input} />
      <button
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? 'Creating key…' : 'Create key + link'}
      </button>
      {res && !res.ok && <ResultLine res={res} />}
      {res?.ok && res.link && (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-xs">
          <p className="font-semibold text-emerald-300">Created. Send this link to the customer:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all text-slate-200">{res.link}</code>
            <Copy value={res.link} label="Copy link" />
          </div>
          {res.key && (
            <div className="flex items-center gap-2">
              <code className="flex-1 break-all text-slate-400">{res.key}</code>
              <Copy value={res.key} label="Copy key" />
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function fmtDay(d: Date) {
  const y = new Date(d.getTime() + 6.5 * 3600_000); // Myanmar time
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][y.getUTCMonth()];
  return `${y.getUTCDate()} ${m} ${y.getUTCFullYear()}`;
}

function yangonDateValue(iso: string) {
  return new Date(new Date(iso).getTime() + 6.5 * 3600_000).toISOString().slice(0, 10);
}

// ── Switch old per-month plans to one total ───────────

export function ConvertOldPlansButton({
  count,
  action,
}: {
  count: number;
  action: (fd: FormData) => Promise<Result>;
}) {
  const { busy, res, run } = useAction(action);
  if (count === 0 && !res) return null;
  return (
    <form action={run} className="mb-3 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-3">
      <p className="text-xs font-semibold text-sky-200">
        {count} active plan{count === 1 ? '' : 's'} still use{count === 1 ? 's' : ''} the old &quot;GB per month&quot; reset
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Switch them to one total for the whole plan (e.g. 200GB × 3 months = 600GB). Data already used is kept, and the
        live key gets the extra data right away. The daily check also does this automatically.
      </p>
      <button
        disabled={busy}
        className="mt-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
      >
        {busy ? 'Switching… (keep page open)' : 'Switch all now'}
      </button>
      <ResultLine res={res} />
    </form>
  );
}

// ── Per-plan actions ───────────────────────────────────

export function SubscriptionActions({
  subscriptionId,
  active,
  expiresAt,
  servers,
  replaceAction,
  extendAction,
  setExpiryAction,
  revokeAction,
}: {
  subscriptionId: string;
  active: boolean;
  expiresAt: string;
  servers: { id: string; label: string }[];
  replaceAction: (fd: FormData) => Promise<Result>;
  extendAction: (fd: FormData) => Promise<Result>;
  setExpiryAction: (fd: FormData) => Promise<Result>;
  revokeAction: (fd: FormData) => Promise<Result>;
}) {
  const rep = useAction(replaceAction);
  const ext = useAction(extendAction);
  const setDate = useAction(setExpiryAction);
  const rev = useAction(revokeAction);
  const [sureRevoke, setSureRevoke] = useState(false);
  const chip =
    'rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-emerald-400 disabled:opacity-50';
  const busy = ext.busy || setDate.busy;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {active && (
          <form action={rep.run} className="flex items-center gap-1">
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            <select name="targetServerId" className="rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200" defaultValue="">
              <option value="">Same server</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <button disabled={rep.busy} className="rounded border border-amber-500/40 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/10">
              {rep.busy ? '…' : 'New key'}
            </button>
          </form>
        )}

        <details className="group">
          <summary className="cursor-pointer list-none rounded border border-emerald-500/40 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10">
            📅 {active ? 'Change expiry' : 'Renew'} ▾
          </summary>
          <div className="mt-2 w-[min(340px,85vw)] space-y-2 rounded-xl border border-slate-700 bg-slate-950 p-3">
            <p className="text-[11px] text-slate-400">
              {active ? 'Add or remove days from the current end date' : 'Add days from today (gets a fresh key)'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(active ? [-3, -1, 1, 3, 7, 15, 30] : [1, 3, 7, 15, 30]).map((d) => (
                <form key={d} action={ext.run}>
                  <input type="hidden" name="subscriptionId" value={subscriptionId} />
                  <input type="hidden" name="days" value={d} />
                  <button
                    disabled={busy}
                    className={`${chip} ${d < 0 ? 'text-rose-300 hover:border-rose-400' : ''}`}
                  >
                    {d > 0 ? `+${d}d` : `${d}d`}
                  </button>
                </form>
              ))}
            </div>
            <form action={setDate.run} className="flex items-center gap-2">
              <input type="hidden" name="subscriptionId" value={subscriptionId} />
              <input
                name="date"
                type="date"
                defaultValue={yangonDateValue(expiresAt)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
              />
              <button disabled={busy} className="rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400">
                Set end date
              </button>
            </form>
            <p className="text-[10px] text-slate-500">Ends at 11:59 PM Myanmar time on the chosen day. Data total stays the same.</p>
          </div>
        </details>

        {active && (
          <form action={rev.run}>
            <input type="hidden" name="subscriptionId" value={subscriptionId} />
            {!sureRevoke ? (
              <button type="button" onClick={() => setSureRevoke(true)} className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:border-rose-400 hover:text-rose-300">
                Revoke
              </button>
            ) : (
              <button disabled={rev.busy} className="rounded bg-rose-500 px-2 py-1 text-[11px] font-bold text-white">
                {rev.busy ? '…' : 'Confirm revoke'}
              </button>
            )}
          </form>
        )}
      </div>
      <ResultLine res={rep.res || ext.res || setDate.res || rev.res} />
    </div>
  );
}
