// app/admin/crypto-rate/page.tsx
import { requireAdmin } from '@/lib/session';
import {
  getLatestStoredRate,
  getRateSettings,
  getEffectiveRate,
  probeReferenceRates,
  fetchBybitPaymentMethods,
} from '@/lib/cryptoRate';
import { saveSettingsAction, refreshNowAction } from './actions';

export const dynamic = 'force-dynamic';

function ago(iso: string | null) {
  if (!iso) return '—';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

export default async function CryptoRatePage() {
  await requireAdmin();

  const settings = await getRateSettings();
  const [stored, effective, pairs, methods] = await Promise.all([
    getLatestStoredRate(),
    getEffectiveRate(5),
    probeReferenceRates(settings.payTypes),
    fetchBybitPaymentMethods(),
  ]);

  const manualAgeHours = settings.updatedAt
    ? (Date.now() - new Date(settings.updatedAt).getTime()) / 3_600_000
    : Infinity;
  const manualOverdue = !settings.manualEnabled || manualAgeHours > 24;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Crypto rate (MMK / USDT)</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your <strong className="text-slate-200">manual rate</strong> is what prices top-ups —
          used exactly as typed. The feeds below are reference only.
        </p>
      </header>

      {/* Rate in use */}
      <div
        className={`rounded-2xl border p-5 ${
          effective
            ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
            : 'border-rose-500/40 bg-rose-950/40'
        }`}
      >
        <p className="text-[11px] uppercase tracking-wide text-slate-400">Rate in use right now</p>
        {effective ? (
          <>
            <p className="mt-1 text-3xl font-bold text-emerald-300">
              {effective.effectiveRate.toLocaleString()}{' '}
              <span className="text-base font-medium text-slate-400">Ks per USDT</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {effective.isManual ? (
                <>
                  Set by you · used exactly as typed (no margin deducted)
                  <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                    MANUAL
                  </span>
                </>
              ) : (
                <>
                  Auto feed · market {effective.marketRate.toLocaleString()} Ks · 5% margin · source{' '}
                  <span className="font-semibold text-slate-200">{effective.source}</span>
                </>
              )}
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-xl font-bold text-rose-300">No usable rate</p>
            <p className="mt-1 text-xs text-rose-200/80">
              Crypto top-ups are DISABLED until a rate exists. Set a manual rate below.
            </p>
          </>
        )}
      </div>

      {/* Overdue banner */}
      {manualOverdue && (
        <div className="rounded-2xl border border-rose-500/50 bg-rose-950/50 p-4">
          <p className="text-sm font-bold text-rose-200">🔴 Manual rate needs setting</p>
          <p className="mt-1 text-xs text-rose-200/80">
            {settings.manualEnabled
              ? `Last set ${Math.floor(manualAgeHours)}h ago. You get a Telegram reminder at 9 AM daily — set it below.`
              : 'No manual rate is active. Crypto top-ups are running on the auto feed, or are disabled.'}
          </p>
        </div>
      )}

      {/* Reference rates — both sources, both sides */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Reference rates (live)</h2>
          <form action={refreshNowAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              Re-fetch
            </button>
          </form>
        </div>
        <p className="mb-3 text-[11px] text-slate-500">
          <strong className="text-slate-300">SELL</strong> is what a merchant pays YOU for USDT —
          that&apos;s the number to base your rate on, since you have to sell what customers send.
          SELL should sit BELOW buy.
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-950/60 text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium text-emerald-400">Sell (use this)</th>
                <th className="px-3 py-2 text-right font-medium">Buy</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => {
                const inverted = !!p.sell.rate && !!p.buy.rate && p.sell.rate >= p.buy.rate;
                return (
                  <tr key={p.source} className="border-t border-slate-800">
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs text-slate-200">{p.source}</span>
                      {inverted && (
                        <span className="ml-2 rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                          SIDES LOOK INVERTED
                        </span>
                      )}
                      {!p.sell.ok && (
                        <p className="mt-0.5 text-[10px] text-rose-300/80">{p.sell.detail}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-base font-bold text-emerald-300">
                        {p.sell.rate ? p.sell.rate.toLocaleString() : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      {p.buy.rate ? p.buy.rate.toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          These are REFERENCE ONLY. Your manual rate below is what actually prices top-ups.
        </p>
      </section>

      {/* Settings: payment method + manual override */}
      <form action={saveSettingsAction} className="space-y-6">
        <section className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] p-5">
          <h2 className="text-sm font-semibold text-sky-200">Payment method</h2>
          <p className="mt-1 text-xs text-sky-100/70">
            KBZ Pay, bank transfer and Wave trade at DIFFERENT rates. Pick the method you actually
            cash out with — leaving all unticked blends them into an average that matches none of
            them.
          </p>

          {methods.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Could not load Bybit&apos;s payment-method list right now. The rates above blend all
              methods until this loads.
            </p>
          ) : (
            <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {methods.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    name="payTypes"
                    value={m.id}
                    defaultChecked={settings.payTypes.includes(m.id)}
                    className="h-3.5 w-3.5 flex-shrink-0 rounded border-slate-600 bg-slate-900 accent-sky-500"
                  />
                  <span className="truncate" title={m.name}>
                    {m.name}
                  </span>
                </label>
              ))}
            </div>
          )}

          {settings.payTypes.length > 0 && (
            <p className="mt-2 text-[11px] text-sky-300">
              Filtering by: {settings.payTypes.join(', ')}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.05] p-5">
          <h2 className="text-sm font-semibold text-amber-200">
            Manual rate — this is the FINAL rate
          </h2>
          <p className="mt-1 text-xs text-amber-100/70">
            The number you type is used EXACTLY as-is. No margin is subtracted — price your own
            margin in. This beats every feed. Set it daily; you get a Telegram nudge at 9 AM.
          </p>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              name="manualEnabled"
              defaultChecked={settings.manualEnabled}
              className="h-4 w-4 rounded border-slate-600 bg-slate-900 accent-amber-500"
            />
            Use manual rate
          </label>

          <div className="mt-3">
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
              MMK per 1 USDT — used exactly as typed (no % deducted)
            </label>
            <input
              name="manualUsdtMmk"
              type="number"
              step="1"
              defaultValue={settings.manualUsdtMmk ?? ''}
              placeholder="e.g. 4500"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-amber-500"
            />
          </div>

          {settings.updatedAt && (
            <p className="mt-2 text-[11px] text-slate-500">Last changed {ago(settings.updatedAt)}</p>
          )}
        </section>

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
        >
          Save settings
        </button>
      </form>

      {/* Last stored */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-100">Last stored auto rate</h2>
        {stored ? (
          <p className="text-sm text-slate-300">
            <span className="text-lg font-bold text-slate-100">
              {stored.usdtMmk.toLocaleString()} Ks
            </span>{' '}
            <span className="text-slate-500">
              · {stored.source} · {ago(stored.createdAt)}
            </span>
          </p>
        ) : (
          <p className="text-sm text-slate-500">No auto rate has ever been stored.</p>
        )}
      </section>
    </div>
  );
}
