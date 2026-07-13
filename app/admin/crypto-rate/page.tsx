// app/admin/crypto-rate/page.tsx
import { requireAdmin } from '@/lib/session';
import {
  getLatestStoredRate,
  getRateSettings,
  getEffectiveRate,
  probeAllSources,
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
  const [stored, effective, probe] = await Promise.all([
    getLatestStoredRate(),
    getEffectiveRate(5),
    probeAllSources(settings.payTypes),
  ]);

  const sellWinner = probe.sell.find((p) => p.ok && p.rate);
  const buyRef = probe.buyReference;

  // If SELL >= BUY the book is inverted — that would mean over-crediting.
  const sidesLookWrong =
    !!sellWinner?.rate && !!buyRef.rate && sellWinner.rate >= buyRef.rate;

  // Payment methods discovered on the live book.
  const discovered = Array.from(
    new Set([...(probe.sell.flatMap((p) => p.payTypesSeen ?? [])), ...settings.payTypes])
  ).sort();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Crypto rate (MMK / USDT)</h1>
        <p className="mt-1 text-sm text-slate-400">
          We use the <strong className="text-slate-200">SELL</strong> side — the price a merchant
          pays you for USDT, because you have to sell what customers send.
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
              Market {effective.marketRate.toLocaleString()} Ks · 5% margin · source{' '}
              <span className="font-semibold text-slate-200">{effective.source}</span>
              {effective.isManual && (
                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  MANUAL
                </span>
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

      {/* SELL vs BUY — verify the sides are the right way round */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-100">Sanity check: SELL vs BUY</h2>
        <p className="mb-3 text-[11px] text-slate-500">
          SELL must be LOWER than BUY (the gap is the market spread). Compare these against the
          Binance app to be certain we&apos;re on the right side of the book.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-wide text-emerald-300/70">
              SELL — we use this
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-300">
              {sellWinner?.rate ? sellWinner.rate.toLocaleString() : '—'}
            </p>
            <p className="text-[10px] text-slate-500">what a merchant pays you</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-3">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">BUY — reference</p>
            <p className="mt-1 text-xl font-bold text-slate-300">
              {buyRef.rate ? buyRef.rate.toLocaleString() : '—'}
            </p>
            <p className="text-[10px] text-slate-500">what you&apos;d pay to buy</p>
          </div>
        </div>

        {sidesLookWrong && (
          <div className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/50 p-3">
            <p className="text-xs font-bold text-rose-200">⚠️ SELL is not below BUY</p>
            <p className="mt-1 text-[11px] text-rose-200/80">
              The sides may be inverted, which would mean crediting customers MORE than you can
              actually cash out. Verify against the Binance app before trusting this rate — and
              use the manual override in the meantime.
            </p>
          </div>
        )}
      </section>

      {/* Feed status */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">Feed status (SELL side)</h2>
          <form action={refreshNowAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              Fetch &amp; store now
            </button>
          </form>
        </div>

        <div className="space-y-2">
          {probe.sell.map((p) => (
            <div
              key={p.source}
              className={`rounded-xl border p-3 ${
                p.ok
                  ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
                  : 'border-rose-500/25 bg-rose-950/25'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs font-semibold text-slate-100">{p.source}</span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    p.ok ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {p.ok ? 'OK' : 'FAILED'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {p.rate ? (
                  <span className="font-semibold text-slate-200">
                    {p.rate.toLocaleString()} Ks ·{' '}
                  </span>
                ) : null}
                {p.detail}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-slate-500">
          Binance blocks US IPs (HTTP 451). Functions are pinned to Singapore
          (<span className="font-mono">sin1</span>) in vercel.json for this reason.
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

          {discovered.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              No methods discovered — the Binance feed must succeed at least once to populate this.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {discovered.map((pt) => (
                <label
                  key={pt}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2.5 py-2 text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    name="payTypes"
                    value={pt}
                    defaultChecked={settings.payTypes.includes(pt)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-sky-500"
                  />
                  <span className="truncate">{pt}</span>
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
          <h2 className="text-sm font-semibold text-amber-200">Manual override</h2>
          <p className="mt-1 text-xs text-amber-100/70">
            When enabled this BEATS every feed. Use it if the feeds are down, or if a real market
            move was blocked by the 10% deviation guard.
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
              MMK per 1 USDT (market rate — the 5% margin is applied on top)
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
