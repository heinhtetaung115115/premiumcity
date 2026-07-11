'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getCryptoQuoteAction, createCryptoTopupAction } from './cryptoActions';

const PRESETS = [5, 10, 20, 50, 100];

export default function CryptoTopupForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [loadingQuote, setLoadingQuote] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [minUsd, setMinUsd] = useState(5);
  const [maxUsd, setMaxUsd] = useState(1000);

  const [amount, setAmount] = useState<string>('10');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const q = await getCryptoQuoteAction();
      if (!alive) return;
      if (q.ok) {
        setRate(q.rate ?? null);
        setMinUsd(q.minUsd ?? 5);
        setMaxUsd(q.maxUsd ?? 1000);
        setAmount(String(Math.max(10, q.minUsd ?? 5)));
      } else {
        setQuoteError(q.error ?? 'Rate unavailable.');
      }
      setLoadingQuote(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const usd = Number(amount);
  const validAmount = Number.isFinite(usd) && usd >= minUsd && usd <= maxUsd;
  const mmk = rate && validAmount ? Math.floor(usd * rate) : 0;

  function submit() {
    setError(null);
    if (!validAmount) {
      setError(`Enter an amount between $${minUsd} and $${maxUsd}.`);
      return;
    }
    startTransition(async () => {
      const res = await createCryptoTopupAction(usd);
      if (res.ok) {
        router.push(`/topup/crypto/${res.topupId}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-emerald-300"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to payment methods
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-gradient-to-r from-teal-500/10 to-transparent p-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-teal-500/15">
            <svg className="h-5 w-5 text-teal-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">Pay with USDT</p>
              <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-teal-300">
                AUTO
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400">Tron network (TRC-20) · credited automatically</p>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {loadingQuote ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
              <svg className="h-4 w-4 animate-spin text-teal-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
              Loading current rate…
            </div>
          ) : quoteError ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
              <p className="font-semibold">Crypto top-up is temporarily unavailable</p>
              <p className="mt-1 text-[12px] text-amber-100/80">{quoteError}</p>
              <p className="mt-2 text-[12px] text-amber-100/80">
                Please use KBZ Pay or bank transfer for now.
              </p>
            </div>
          ) : (
            <>
              {/* Rate banner */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2.5">
                <span className="text-[11px] text-slate-500">Current rate</span>
                <span className="text-[13px] font-semibold text-teal-300">
                  1 USDT = {rate?.toLocaleString('en-US')} Ks
                </span>
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">
                  Amount to send (USDT)
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 focus-within:border-teal-500">
                  <span className="text-sm font-semibold text-slate-500">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={minUsd}
                    max={maxUsd}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent text-lg font-semibold text-slate-50 outline-none"
                  />
                  <span className="flex-shrink-0 text-xs text-slate-500">USDT</span>
                </div>
                <p className="mt-1 text-[10px] text-slate-500">
                  Min ${minUsd} · Max ${maxUsd}
                </p>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {PRESETS.filter((p) => p >= minUsd).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      Number(amount) === p
                        ? 'border-teal-500 bg-teal-500/15 text-teal-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    ${p}
                  </button>
                ))}
              </div>

              {/* Conversion preview */}
              <div className="rounded-xl border border-teal-500/25 bg-gradient-to-br from-teal-500/[0.12] to-transparent p-4">
                <p className="text-[11px] text-slate-400">You will receive</p>
                <p className="mt-0.5 text-2xl font-bold text-teal-300">
                  {mmk > 0 ? mmk.toLocaleString('en-US') : '—'}{' '}
                  <span className="text-sm font-semibold">Ks</span>
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  Rate is locked for 30 minutes once you continue.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-[12px] text-rose-200">
                  {error}
                </div>
              )}

              <button
                onClick={submit}
                disabled={pending || !validAmount}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                )}
                {pending ? 'Creating payment…' : 'Continue to payment'}
              </button>

              <p className="text-center text-[10px] leading-relaxed text-slate-600">
                Send only <span className="text-slate-400">USDT on the Tron (TRC-20) network</span>.
                Sending any other coin or network may result in permanent loss.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
