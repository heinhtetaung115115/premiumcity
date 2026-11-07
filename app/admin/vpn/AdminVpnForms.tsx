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
  activeCustomers,
  otherServers,
  updateAction,
  moveAction,
}: {
  serverId: string;
  paidUntil: string | null;
  acceptingNew: boolean;
  isActive: boolean;
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
  return (
    <form action={run} className="space-y-2">
      <input name="note" placeholder="Customer (e.g. Ko Aung · Viber 09xxxx)" className={input} required />
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Data per month (GB, 0 = unlimited)</span>
          <input name="dataGb" type="number" min={0} step="1" defaultValue={100} className={input} />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Months</span>
          <input name="months" type="number" min={1} max={24} defaultValue={1} className={input} />
        </label>
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
      <input name="planName" placeholder="Plan name (optional, e.g. Japan 100GB)" className={input} />
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

// ── Per-plan actions ───────────────────────────────────

export function SubscriptionActions({
  subscriptionId,
  active,
  servers,
  replaceAction,
  extendAction,
  revokeAction,
}: {
  subscriptionId: string;
  active: boolean;
  servers: { id: string; label: string }[];
  replaceAction: (fd: FormData) => Promise<Result>;
  extendAction: (fd: FormData) => Promise<Result>;
  revokeAction: (fd: FormData) => Promise<Result>;
}) {
  const rep = useAction(replaceAction);
  const ext = useAction(extendAction);
  const rev = useAction(revokeAction);
  const [sureRevoke, setSureRevoke] = useState(false);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
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
      <form action={ext.run} className="flex items-center gap-1">
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <input name="days" type="number" min={1} defaultValue={30} className="w-14 rounded border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200" />
        <button disabled={ext.busy} className="rounded border border-emerald-500/40 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10">
          {ext.busy ? '…' : '+ days'}
        </button>
      </form>
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
      <ResultLine res={rep.res || ext.res || rev.res} />
    </div>
  );
}
