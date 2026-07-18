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
      setCodeLoading(false);
    }
  }, [orderItemId]);

  useEffect(() => {
    load();
  }, [load]);

  const getCode = async () => {
    setCodeLoading(true);
    // The code is fetched fresh server-side; just reload the panel.
    await load();
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
          {profile.name && <Row label="Profile" value={profile.name} />}
          {profile.pin && <Row label="PIN" value={profile.pin} />}
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
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Verification code
              </p>
              <button
                type="button"
                onClick={getCode}
                disabled={codeLoading}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-400 disabled:opacity-50"
              >
                {codeLoading ? 'Checking…' : 'Get code'}
              </button>
            </div>

            {codes.length > 0 ? (
              <div className="space-y-2">
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
            ) : (
              <p className="text-[11px] text-slate-500">
                No code yet. On the Netflix screen, request the code, then tap
                &ldquo;Get code&rdquo;. Codes appear for about 15 minutes.
              </p>
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
            ⚠ Please don&apos;t change the account password or PIN. If something looks wrong,
            copy your Order ID and contact support.
          </p>
        </div>
      )}
    </div>
  );
}
