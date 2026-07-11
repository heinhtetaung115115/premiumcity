'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCryptoQuoteAction,
  getNetworksAction,
  createCryptoTopupAction,
  type NetworkChoice,
} from './cryptoActions';

const PRESETS = [5, 10, 20, 50, 100];

export default function CryptoTopupForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [maxUsd, setMaxUsd] = useState(1000);

  const [networks, setNetworks] = useState<NetworkChoice[]>([]);
  const [selected, setSelected] = useState<string>('');

  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [q, n] = await Promise.all([getCryptoQuoteAction(), getNetworksAction()]);
      if (!alive) return;

      if (q.ok) {
        setRate(q.rate ?? null);
        setMaxUsd(q.maxUsd ?? 1000);
      } else {
        setQuoteError(q.error ?? 'Rate unavailable.');
      }

      if (n.ok && n.networks) {
        const avail = n.networks.filter((x) => x.available);
        setNetworks(n.networks);
        const first = avail[0];
        if (first) {
          setSelected(first.code);
          setAmount(String(Math.max(10, Math.ceil(first.minUsd ?? 5))));
        }
      }

      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const activeNetwork = useMemo(
    () => networks.find((n) => n.code === selected) ?? null,
    [networks, selected]
  );

  const minUsd = activeNetwork?.minUsd ?? 5;
  const usd = Number(amount);
  const validAmount = Number.isFinite(usd) && usd >= minUsd && usd <= maxUsd;
  const mmk = rate && validAmount ? Math.floor(usd * rate) : 0;

  function pickNetwork(code: string) {
    setSelected(code);
    setError(null);
    const n = networks.find((x) => x.code === code);
    if (n?.minUsd && Number(amount) < n.minUsd) {
      setAmount(String(Math.ceil(n.minUsd)));
    }
  }

  function submit() {
    setError(null);
    if (!selected) {
      setError('Please choose a network.');
      return;
    }
    if (!validAmount) {
      setError(`Enter an amount between $${minUsd} and $${maxUsd}.`);
      return;
    }
    startTransition(async () => {
      const res = await createCryptoTopupAction(usd, selected);
      if (res.ok && res.topupId) {
        router.push(`/topup/crypto/${res.topupId}`);
      } else {
        setError(res.error || 'Could not create payment. Please try again.');
      }
    });
  }

  const availableNetworks = networks.filter((n) => n.available);

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
          <p className="text-sm text-slate-400">Loading rates &amp; networks…</p>
        </div>
      )}

      {!loading && quoteError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p className="font-semibold">Crypto top-up unavailable</p>
          <p className="mt-1 text-amber-100/80">{quoteError}</p>
        </div>
      )}

      {!loading && !quoteError && (
        <>
          {rate && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
              <p className="text-[11px] uppercase tracking-wide text-emerald-300/70">Current rate</p>
              <p className="mt-0.5 text-lg font-bold text-emerald-300">
                1 USDT ≈ {rate.toLocaleString()} <span className="text-sm">Ks</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Rate is locked when you create the payment.
              </p>
            </div>
          )}

          {/* Network selector */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-100">Choose network</p>

            {availableNetworks.length === 0 ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-100">
                No networks are available right now. Please try another payment method.
              </div>
            ) : (
              <div className="space-y-2">
                {availableNetworks.map((n) => {
                  const isActive = n.code === selected;
                  return (
                    <button
                      key={n.code}
                      type="button"
                      onClick={() => pickNetwork(n.code)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          isActive ? 'border-emerald-400' : 'border-slate-600'
                        }`}
                      >
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-100">{n.label}</span>
                          <span className="text-[11px] text-slate-400">{n.network}</span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-500">{n.note}</p>
                      </div>

                      <div className="flex-shrink-0 text-right">
                        <p className="text-[9px] uppercase text-slate-500">Min</p>
                        <p className="text-xs font-bold text-slate-200">${n.minUsd?.toFixed(2)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {availableNetworks.length > 0 && (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-100">Amount (USD)</p>

                <div className="mb-2 flex flex-wrap gap-2">
                  {PRESETS.filter((p) => p >= minUsd).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAmount(String(p));
                        setError(null);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        Number(amount) === p
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 focus-within:border-emerald-500">
                  <span className="text-sm font-semibold text-slate-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={minUsd}
                    max={maxUsd}
                    step="0.01"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      setError(null);
                    }}
                    className="w-full bg-transparent text-sm text-slate-50 outline-none"
                    placeholder={String(minUsd)}
                  />
                </div>

                <p className="mt-1 text-[11px] text-slate-500">
                  Min ${minUsd} · Max ${maxUsd} on{' '}
                  <span className="text-slate-400">{activeNetwork?.network}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">You will receive</p>
                <p className="mt-0.5 text-2xl font-bold text-emerald-400">
                  {mmk > 0 ? mmk.toLocaleString() : '—'} <span className="text-base">Ks</span>
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={pending || !validAmount || !selected}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                )}
                {pending ? 'Creating payment…' : 'Continue to payment'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
