'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Props = {
  topupId: string;
  coin: string;
  network: string;
  payAddress: string;
  payAmount: number;
  usdAmount: number;
  mmkAmount: number;
  rate: number;
  status: string;
  credited: boolean;
  payUrl: string;
  expiresAt: string | null;
};

const NETWORK_LABEL: Record<string, string> = {
  tron: 'Tron (TRC-20)',
  eth: 'Ethereum (ERC-20)',
  bsc: 'BNB Smart Chain (BEP-20)',
  polygon: 'Polygon',
  sol: 'Solana',
  ton: 'TON',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  btc: 'Bitcoin',
  ltc: 'Litecoin',
  doge: 'Dogecoin',
  bch: 'Bitcoin Cash',
};

export default function CryptoPaymentClient(props: Props) {
  const [credited, setCredited] = useState(props.credited);
  const [status, setStatus] = useState(props.status);
  const [mmk, setMmk] = useState(props.mmkAmount);
  const [copied, setCopied] = useState<string | null>(null);

  // The network the customer ACTUALLY chose. Never hardcode this — telling
  // someone "Tron only" when they picked Solana would destroy their funds.
  const netLabel =
    NETWORK_LABEL[props.network?.toLowerCase()] ?? props.network?.toUpperCase() ?? '';

  // Poll until credited.
  useEffect(() => {
    if (credited) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/crypto/status?id=${props.topupId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        setStatus(d.status);
        if (d.credited) {
          setCredited(true);
          setMmk(d.mmk);
          clearInterval(t);
        }
      } catch {
        /* keep polling */
      }
    }, 6000);
    return () => clearInterval(t);
  }, [credited, props.topupId]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
    props.payAddress
  )}`;

  if (credited) {
    return (
      <div className="mx-auto max-w-md space-y-5 py-6">
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.08] p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500">
            <svg className="h-8 w-8 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-emerald-300">Payment received</h1>
          <p className="mt-2 text-sm text-slate-300">
            <span className="text-2xl font-bold text-emerald-400">{mmk.toLocaleString()} Ks</span>
            <br />
            has been added to your wallet.
          </p>
          <Link
            href="/account"
            className="mt-5 inline-block rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-400"
          >
            Go to my wallet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm font-semibold text-amber-300">Waiting for your payment…</p>
        </div>

        <p className="text-[11px] uppercase tracking-wide text-slate-500">Send exactly</p>
        <button
          onClick={() => copy(String(props.payAmount), 'amt')}
          className="mt-1 flex w-full items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-3 py-3"
        >
          <span className="text-xl font-bold text-emerald-400">
            {props.payAmount} <span className="text-xs font-semibold">{props.coin}</span>
          </span>
          <span className="text-[10px] text-slate-500">{copied === 'amt' ? 'Copied!' : 'Tap to copy'}</span>
        </button>

        <div className="my-4 flex justify-center rounded-xl bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Payment address QR" width={220} height={220} />
        </div>

        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          To this address ({netLabel})
        </p>
        <button
          onClick={() => copy(props.payAddress, 'addr')}
          className="mt-1 flex w-full items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left"
        >
          <span className="break-all font-mono text-xs text-slate-200">{props.payAddress}</span>
          <span className="flex-shrink-0 text-[10px] text-slate-500">
            {copied === 'addr' ? 'Copied!' : 'Copy'}
          </span>
        </button>

        {/* The single most important warning on this page. */}
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/40 p-3">
          <p className="text-xs text-rose-100">
            ⚠️ Send <span className="font-bold">{props.coin}</span> on the{' '}
            <span className="font-bold">{netLabel}</span> network only. Sending on any other
            network will permanently lose your funds.
          </p>
        </div>

        <div className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
          <div className="flex justify-between">
            <span>You pay</span>
            <span className="text-slate-300">${props.usdAmount}</span>
          </div>
          <div className="flex justify-between">
            <span>Rate (locked)</span>
            <span className="text-slate-300">1 USD = {props.rate.toLocaleString()} Ks</span>
          </div>
          <div className="flex justify-between">
            <span>You receive (approx.)</span>
            <span className="font-semibold text-emerald-400">
              {props.mmkAmount.toLocaleString()} Ks
            </span>
          </div>
          <p className="pt-1 text-[10px] text-slate-600">
            Credited automatically once the network confirms. You can close this page.
          </p>
        </div>

        {props.payUrl && (
          <a
            href={props.payUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block text-center text-[11px] text-slate-500 underline hover:text-slate-300"
          >
            Open the secure payment page instead
          </a>
        )}
      </div>

      <p className="text-center text-[10px] text-slate-600">Status: {status}</p>
    </div>
  );
}
