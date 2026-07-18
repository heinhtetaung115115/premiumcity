'use client';

import { useCallback, useEffect, useState } from 'react';

type Profile = {
  email: string | null;
  password: string | null;
  name: string | null;
  pin: string | null;
  endDate: string | null;
};
type Message = {
  subject: string | null;
  from: string | null;
  code: string | null;
  body: string | null;
  date: string | null;
};

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="flex-shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.05em] text-slate-500">{label}</p>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <span className="min-w-0 break-all font-mono text-[13px] text-slate-100">{value}</span>
        <Copy value={value} />
      </div>
    </div>
  );
}

export function NetflixPanel({ orderItemId }: { orderItemId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [codeLoading, setCodeLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [renewState, setRenewState] = useState<'idle' | 'sending' | 'done'>('idle');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/netflix/panel?orderItemId=${encodeURIComponent(orderItemId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'Could not load the account.');
        setProfile(null);
        return;
      }
      const d = await res.json();
      setProfile(d.profile);
      setMessages(Array.isArray(d.messages) ? d.messages : []);
      setError(null);
    } catch {
      setError('Could not load the account.');
    } finally {
      setLoading(false);
    }
  }, [orderItemId]);

  useEffect(() => {
    load();
  }, [load]);

  const getCode = async () => {
    setShowModal(true);
    setCodeLoading(true);
    // The code is fetched fresh server-side; just reload the panel.
    await load();
    setCodeLoading(false);
  };

  const requestRenew = async () => {
    setRenewState('sending');
    try {
      const res = await fetch('/api/netflix/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId }),
      });
      setRenewState(res.ok ? 'done' : 'idle');
      if (!res.ok) setError('Could not send the renewal request.');
    } catch {
      setRenewState('idle');
      setError('Could not send the renewal request.');
    }
  };

  const codes = messages.filter((m) => m.code);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-red-500/25 bg-gradient-to-br from-red-500/[0.08] to-red-800/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5 2v20l7-4 7 4V2z" />
        </svg>
        <span className="text-xs font-semibold text-red-200">Your Netflix account</span>
      </div>

      {loading && <p className="text-xs text-slate-400">Loading account…</p>}

      {!loading && error && !profile && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-100">
          {error}
        </div>
      )}

      {profile && (
        <div className="space-y-2">
          {profile.email && <Row label="Email" value={profile.email} />}
          {profile.password && <Row label="Password" value={profile.password} />}
          {profile.endDate && (
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-[0.05em] text-slate-500">Expires</p>
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                <span className="font-mono text-[13px] text-slate-100">{profile.endDate}</span>
              </div>
            </div>
          )}

          {/* Codes */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
              Verification code
            </p>

            <p className="mb-3 text-[12px] leading-relaxed text-slate-300">
              Household code နှင့် OTP login code များ ရယူရန် get code ကိုနှိပ်ပေးပါ
            </p>

            <button
              type="button"
              onClick={getCode}
              disabled={codeLoading}
              className="w-full rounded-lg bg-emerald-500 px-3 py-2.5 text-[13px] font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {codeLoading ? 'Code ကိုရယူနေပါသည်…' : 'Get code'}
            </button>

            {codes.length > 0 && (
              <div className="mt-3 space-y-2">
                {codes.map((m, i) => (
                  <div key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-lg font-bold text-emerald-300">{m.code}</span>
                      <Copy value={m.code!} />
                    </div>
                    {m.subject && <p className="mt-1 text-[10px] text-slate-400">{m.subject}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Renewal */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
            <span className="text-[11px] text-slate-400">
              Subscription ending? Request an extension.
            </span>
            <button
              type="button"
              onClick={requestRenew}
              disabled={renewState !== 'idle'}
              className="flex-shrink-0 rounded-lg border border-amber-500/40 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-60"
            >
              {renewState === 'done'
                ? 'Requested ✓'
                : renewState === 'sending'
                ? 'Sending…'
                : 'သက်တမ်းတိုးမယ်'}
            </button>
          </div>

          {renewState === 'done' && (
            <p className="text-[10px] text-emerald-300">
              Your renewal request was sent. We&apos;ll update your account shortly.
            </p>
          )}

          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
            ⚠ Please don&apos;t change the account password. If something looks wrong,
            copy your Order ID and contact support.
          </p>
        </div>
      )}

      {/* Get-code modal: loading animation, then the code with a copy button */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !codeLoading && setShowModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {codeLoading ? (
              <div className="flex flex-col items-center py-4 text-center">
                {/* animated pulsing rings */}
                <div className="relative mb-5 h-16 w-16">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/30" />
                  <span className="absolute inset-2 animate-ping rounded-full bg-emerald-500/40 [animation-delay:150ms]" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="h-8 w-8 animate-spin text-emerald-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-100">Code ကိုရယူနေပါသည်…</p>
                <p className="mt-1 text-[11px] text-slate-500">ခဏစောင့်ပေးပါ</p>
              </div>
            ) : codes.length > 0 ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15">
                  <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Your code</p>
                <div className="mt-2 space-y-2">
                  {codes.map((m, i) => (
                    <div key={i} className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-2xl font-bold tracking-wider text-emerald-300">
                          {m.code}
                        </span>
                        <Copy value={m.code!} />
                      </div>
                      {m.subject && <p className="mt-1 text-left text-[10px] text-slate-400">{m.subject}</p>}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  ပိတ်မယ်
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/15">
                  <svg className="h-6 w-6 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-100">Code မတွေ့သေးပါ</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Netflix ဖန်သားပြင်တွင် code တောင်းပြီးမှ ထပ်မံ Get code နှိပ်ပေးပါ။ Code သည် ၁၅ မိနစ်ခန့် ပေါ်နေပါမည်။
                </p>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  ပိတ်မယ်
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
