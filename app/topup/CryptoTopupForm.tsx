'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCryptoQuoteAction,
  getCoinsAction,
  createCryptoTopupAction,
  type CoinChoice,
} from './cryptoActions';

const PRESETS = [3, 5, 10, 20, 50];

const NETWORK_LABEL: Record<string, string> = {
  tron: 'Tron (TRC-20)',
  TRON: 'Tron (TRC-20)',
  eth: 'Ethereum (ERC-20)',
  ETH: 'Ethereum (ERC-20)',
  bsc: 'BNB Smart Chain',
  BSC: 'BNB Smart Chain',
  polygon: 'Polygon',
  POLYGON: 'Polygon',
  sol: 'Solana',
  SOL: 'Solana',
  ton: 'TON',
  TON: 'TON',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  bch: 'Bitcoin Cash',
  btc: 'Bitcoin',
  BTC: 'Bitcoin',
  ltc: 'Litecoin',
  LTC: 'Litecoin',
  doge: 'Dogecoin',
  DOGE: 'Dogecoin',
};

const label = (n: string) => NETWORK_LABEL[n] ?? NETWORK_LABEL[n?.toLowerCase()] ?? n;

// Real coin logos from the MIT-licensed cryptocurrency-icons set. Falls back
// to a lettered badge for any ticker the set doesn't cover.
const ICON_BASE =
  'https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color';

// A few network names map to a coin ticker for the logo.
const NETWORK_ICON: Record<string, string> = {
  tron: 'trx',
  trc20: 'trx',
  bsc: 'bnb',
  'bnb smart chain': 'bnb',
  polygon: 'matic',
  pol: 'matic',
  ethereum: 'eth',
  erc20: 'eth',
  solana: 'sol',
  arbitrum: 'eth',
  avalanche: 'avax',
  bitcoin: 'btc',
  litecoin: 'ltc',
  dogecoin: 'doge',
  ton: 'ton',
};

function iconSlug(key: string): string {
  const k = (key || '').toLowerCase();
  return NETWORK_ICON[k] ?? k;
}

function CoinIcon({ ticker, size = 28 }: { ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const slug = iconSlug(ticker);

  if (failed || !slug) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] font-bold text-slate-200"
      >
        {(ticker || '?').slice(0, 3).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ICON_BASE}/${slug}.svg`}
      width={size}
      height={size}
      alt={ticker}
      onError={() => setFailed(true)}
      className="flex-shrink-0"
    />
  );
}

export default function CryptoTopupForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);

  const [rate, setRate] = useState<number | null>(null);
  const [minUsd, setMinUsd] = useState(3);
  const [maxUsd, setMaxUsd] = useState(1000);

  const [coins, setCoins] = useState<CoinChoice[]>([]);
  const [currency, setCurrency] = useState<string>('');
  const [network, setNetwork] = useState<string>('');

  const [amount, setAmount] = useState('5');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [q, c] = await Promise.all([getCryptoQuoteAction(), getCoinsAction()]);
      if (!alive) return;

      if (!q.ok) {
        setFatal(q.error ?? 'Rate unavailable.');
      } else {
        setRate(q.rate ?? null);
        setMinUsd(q.minUsd ?? 3);
        setMaxUsd(q.maxUsd ?? 1000);
      }

      if (c.ok && c.coins?.length) {
        setCoins(c.coins);
        const first = c.coins[0];
        setCurrency(first.currency);
        setNetwork(first.network);
      } else if (!c.ok) {
        setFatal(c.error ?? 'Could not load coins.');
      }

      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Distinct coins, and the networks available for the selected coin.
  const currencies = useMemo(
    () => Array.from(new Set(coins.map((c) => c.currency))),
    [coins]
  );
  const networksFor = useMemo(
    () => coins.filter((c) => c.currency === currency),
    [coins, currency]
  );
  const selected = useMemo(
    () => coins.find((c) => c.currency === currency && c.network === network) ?? null,
    [coins, currency, network]
  );

  // Effective floor = our minimum, or the network's, whichever is higher.
  const floor = Math.max(minUsd, selected?.minUsd ?? 0);
  const usd = Number(amount);
  const valid = Number.isFinite(usd) && usd >= floor && usd <= maxUsd && !!selected;

  // What they'll actually receive, after the gateway's cut.
  const feePct = selected?.commissionPercent ?? 0;
  const netUsd = valid ? usd * (1 - feePct / 100) : 0;
  const mmk = rate && valid ? Math.floor(netUsd * rate) : 0;

  function pickCurrency(c: string) {
    setCurrency(c);
    const nets = coins.filter((x) => x.currency === c);
    if (nets.length) setNetwork(nets[0].network);
    setError(null);
  }

  function submit() {
    setError(null);
    if (!selected) return setError('Choose a coin and network.');
    if (!valid) return setError(`Enter an amount between $${floor} and $${maxUsd}.`);

    startTransition(async () => {
      const res = await createCryptoTopupAction(usd, selected.currency, selected.network);
      if (res.ok && res.topupId) {
        router.push(`/topup/crypto/${res.topupId}`);
      } else {
        setError(res.error || 'Could not create payment.');
      }
    });
  }

  const input =
    'w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-50 outline-none focus:border-emerald-500';

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
          <p className="text-sm text-slate-400">Loading rates &amp; coins…</p>
        </div>
      )}

      {!loading && fatal && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p className="font-semibold">Crypto top-up unavailable</p>
          <p className="mt-1 text-amber-100/80">{fatal}</p>
        </div>
      )}

      {!loading && !fatal && (
        <>
          {rate && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.07] p-4">
              <p className="text-[11px] uppercase tracking-wide text-emerald-300/70">Today&apos;s rate</p>
              <p className="mt-0.5 text-lg font-bold text-emerald-300">
                1 USD ≈ {rate.toLocaleString()} <span className="text-sm">Ks</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-400">Locked when you create the payment.</p>
            </div>
          )}

          {/* 1. Coin — icon grid */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-100">1. Choose coin</p>
            <div className="grid grid-cols-3 gap-2">
              {currencies.map((c) => {
                const active = currency === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => pickCurrency(c)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 transition ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <CoinIcon ticker={c} size={28} />
                    <span
                      className={`text-xs font-semibold ${
                        active ? 'text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {c}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Network — list for the chosen coin */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-100">
              2. Choose network{currency ? ` for ${currency}` : ''}
            </p>
            <div className="space-y-2">
              {networksFor.map((n) => {
                const active = n.network === network;
                return (
                  <button
                    key={`${n.currency}-${n.network}`}
                    type="button"
                    onClick={() => {
                      setNetwork(n.network);
                      setError(null);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/10'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                    }`}
                  >
                    <CoinIcon ticker={n.network} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-100">{label(n.network)}</p>
                      <p className="text-[10px] text-slate-500">
                        {n.minUsd !== null
                          ? `min $${Math.max(minUsd, n.minUsd)}`
                          : `min ${n.minAmount} ${n.currency}`}
                        {' · '}
                        {n.commissionPercent}% fee
                      </p>
                    </div>
                    {active ? (
                      <svg className="h-5 w-5 flex-shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-slate-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-100">Amount (USD)</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {PRESETS.filter((p) => p >= floor).map((p) => (
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
                min={floor}
                max={maxUsd}
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="w-full bg-transparent text-sm text-slate-50 outline-none"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Min ${floor} · Max ${maxUsd}
            </p>
          </div>

          {/* Receive */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">You will receive</p>
            <p className="mt-0.5 text-2xl font-bold text-emerald-400">
              {mmk > 0 ? mmk.toLocaleString() : '—'} <span className="text-base">Ks</span>
            </p>
            {feePct > 0 && valid && (
              <p className="mt-1 text-[11px] text-slate-500">
                After the {feePct}% network fee (${netUsd.toFixed(2)} net)
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={pending || !valid}
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
    </div>
  );
}
