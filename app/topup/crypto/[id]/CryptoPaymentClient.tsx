'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Props = {
  topupId: string;
  coinLabel: string;
  networkName: string;
  payAddress: string;
  payAmount: number;
  usdAmount: number;
  mmkAmount: number;
  rate: number;
  status: string;
  credited: boolean;
  expiresAt: string | null;
};

const DONE = ['CREDITED'];
const DEAD = ['FAILED', 'EXPIRED', 'REFUNDED'];

export default function CryptoPaymentClient(props: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(props.status);
  const [credited, setCredited] = useState(props.credited);
  const [copied, setCopied] = useState<'addr' | 'amt' | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const isDone = credited || DONE.includes(status);
  const isDead = DEAD.includes(status);
  const isUnderpaid = status === 'UNDERPAID';

  // Countdown to rate-lock expiry
  useEffect(() => {
    if (!props.expiresAt || isDone || isDead) return;
    const tick = () => {
      const ms = new Date(props.expiresAt!).getTime() - Date.now();
      setSecondsLeft(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [props.expiresAt, isDone, isDead]);

  // Poll for confirmation
  useEffect(() => {
    if (isDone || isDead) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/crypto/status?id=${props.topupId}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json.status) setStatus(json.status);
        if (json.credited) {
          setCredited(true);
          clearInterval(t);
          setTimeout(() => router.refresh(), 800);
        }
      } catch {
        /* keep polling */
      }
    }, 6000);
    return () => clearInterval(t);
  }, [props.topupId, isDone, isDead, router]);

  function copy(text: string, which: 'addr' | 'amt') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    });
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
    props.payAddress
  )}`;

  const mm = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const ss = secondsLeft !== null ? secondsLeft % 60 : 0;

  // ── SUCCESS ──
  if (isDone) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.15] to-transparent p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-7 w-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-50">Payment received</h1>
          <p className="mt-1 text-sm text-slate-400">Your wallet has been topped up.</p>
          <p className="mt-4 text-3xl font-bold text-emerald-400">
            +{props.mmkAmount.toLocaleString('en-US')} <span className="text-base">Ks</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="flex-1 rounded-xl bg-emerald-500 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Start shopping
          </Link>
          <Link
            href="/account"
            className="flex-1 rounded-xl border border-slate-700 py-3 text-center text-sm font-semibold text-slate-200 transition hover:border-emerald-500/50"
          >
            My account
          </Link>
        </div>
      </div>
    );
  }

  // ── FAILED / EXPIRED ──
  if (isDead) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-6 text-center">
          <h1 className="text-xl font-semibold text-slate-50">
            Payment {status.toLowerCase()}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            This payment is no longer valid. If you already sent funds, contact support with
            your order reference and we&apos;ll sort it out.
          </p>
        </div>
        <Link
          href="/topup"
          className="block rounded-xl bg-emerald-500 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          Start a new top-up
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* Underpaid warning */}
      {isUnderpaid && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/50 px-4 py-3 text-sm text-amber-50">
          <p className="font-semibold">Amount didn&apos;t match</p>
          <p className="mt-1 text-[12px] text-amber-100/85">
            We received less than the invoiced amount. Our team has been notified and will
            review it manually — no action needed from you right now.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
        {/* Status header */}
        <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-950/40 p-4">
          <span className="relative flex h-3 w-3 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-teal-400" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">
              {status === 'CONFIRMING' || status === 'CONFIRMED' || status === 'SENDING'
                ? 'Payment detected — confirming…'
                : 'Waiting for your payment'}
            </p>
            <p className="text-[11px] text-slate-500">
              {status === 'WAITING' || status === 'NEW'
                ? 'Send the exact amount below'
                : 'This will complete automatically'}
            </p>
          </div>
          {secondsLeft !== null && secondsLeft > 0 && (
            <span className="flex-shrink-0 rounded-lg bg-slate-800 px-2 py-1 font-mono text-xs text-slate-300">
              {mm}:{String(ss).padStart(2, '0')}
            </span>
          )}
        </div>

        <div className="space-y-4 p-4">
          {/* Amount to send */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">
              Send exactly
            </label>
            <button
              onClick={() => copy(String(props.payAmount), 'amt')}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-teal-500/30 bg-teal-500/[0.08] px-3 py-3 text-left transition hover:border-teal-500/60"
            >
              <span className="text-lg font-bold text-teal-300">
                {props.payAmount} <span className="text-xs font-semibold">{props.coinLabel}</span>
              </span>
              <span className="flex-shrink-0 text-[10px] text-slate-400">
                {copied === 'amt' ? '✓ Copied' : 'Tap to copy'}
              </span>
            </button>
          </div>

          {/* QR */}
          <div className="flex justify-center rounded-xl bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Payment address QR code" width={220} height={220} />
          </div>

          {/* Address */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">
              To this address ({props.networkName})
            </label>
            <button
              onClick={() => copy(props.payAddress, 'addr')}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left transition hover:border-teal-500/50"
            >
              <span className="flex-1 break-all font-mono text-[11px] text-slate-200">
                {props.payAddress}
              </span>
              <span className="flex-shrink-0 text-[10px] text-slate-400">
                {copied === 'addr' ? '✓' : 'Copy'}
              </span>
            </button>
          </div>

          {/* Network warning */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-amber-100/90">
              <span className="font-semibold">{props.networkName} network only.</span> Sending{' '}
              {props.coinLabel} on any other network will result in permanent loss of your funds.
            </p>
          </div>

          {/* Summary */}
          <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[12px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Rate locked</span>
              <span className="text-slate-300">1 {props.coinLabel} = {props.rate.toLocaleString()} Ks</span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-1.5">
              <span className="text-slate-500">You&apos;ll receive</span>
              <span className="font-semibold text-emerald-400">
                {props.mmkAmount.toLocaleString()} Ks
              </span>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-600">
            This page updates automatically once your payment confirms — you can leave it open.
          </p>
        </div>
      </div>

      <Link
        href="/topup"
        className="block text-center text-xs text-slate-500 transition hover:text-slate-300"
      >
        Cancel and go back
      </Link>
    </div>
  );
}
