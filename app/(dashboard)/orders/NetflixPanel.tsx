'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
  link?: string | null;
  linkLabel?: string | null;
  body: string | null;
  date: string | null;
  timestamp: number | null;
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

/** A sign-in code (copyable), or for household emails a button to Netflix's confirm link. */
function CodeOrLink({ m, size }: { m: Message; size: 'sm' | 'lg' }) {
  if (m.code) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-mono font-bold text-emerald-300 ${
            size === 'lg' ? 'text-2xl tracking-wider' : 'text-lg'
          }`}
        >
          {m.code}
        </span>
        <Copy value={m.code} />
      </div>
    );
  }
  if (m.link) {
    return (
      <div className="space-y-1.5 text-left">
        <a
          href={m.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400"
        >
          {m.linkLabel || 'Open link'}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M7 17L17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <p className="text-[10px] leading-relaxed text-slate-400">
          Netflix Household အတည်ပြုရန် အပေါ်ကခလုတ်ကိုနှိပ်ပါ (၁၅ မိနစ်အတွင်း)
        </p>
      </div>
    );
  }
  return null;
}

export function NetflixPanel({ orderItemId }: { orderItemId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [codeLoading, setCodeLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(
    async (withCodes: boolean) => {
      try {
        const res = await fetch(
          `/api/netflix/panel?orderItemId=${encodeURIComponent(orderItemId)}${
            withCodes ? '&codes=1' : ''
          }`,
          { cache: 'no-store' }
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d?.error || 'Could not load the account.');
          setProfile(null);
          return null;
        }
        const d = await res.json();
        setProfile(d.profile);
        setNote(typeof d.note === 'string' && d.note.trim() ? d.note : null);
        // Only overwrite codes when we actually asked for them, so a plain
        // profile refresh never wipes a code the customer just fetched.
        const msgs: Message[] = Array.isArray(d.messages) ? d.messages : [];
        if (withCodes) setMessages(msgs);
        setError(null);
        return msgs;
      } catch {
        setError('Could not load the account.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orderItemId]
  );

  // On open: profile only. No codes are fetched or shown until the button.
  useEffect(() => {
    load(false);
  }, [load]);

  // The supplier receives Netflix's email 2–3 minutes after the customer
  // requests it. So "Get code" keeps checking every 10s (up to 4 min) and
  // shows the code the moment it lands, instead of saying "not found" at once.
  const POLL_EVERY_MS = 10_000;
  const MAX_WAIT_MS = 4 * 60_000;
  const pollRun = useRef(0); // bumping this cancels a running poll
  const [waitStart, setWaitStart] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!codeLoading) return;
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [codeLoading]);

  const hasFreshItem = (msgs: Message[] | null) =>
    !!msgs?.some((m) => {
      if (!m.code && !m.link) return false;
      if (!m.timestamp || !Number.isFinite(m.timestamp)) return true;
      return Date.now() - m.timestamp < 15 * 60 * 1000;
    });

  const getCode = async () => {
    const run = ++pollRun.current;
    setShowModal(true);
    setCodeLoading(true);
    const started = Date.now();
    setWaitStart(started);
    setTick(started);

    while (pollRun.current === run) {
      const msgs = await load(true); // this fetch asks for codes
      if (pollRun.current !== run) return; // closed or restarted meanwhile
      if (hasFreshItem(msgs) || Date.now() - started >= MAX_WAIT_MS) break;
      await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
    }
    if (pollRun.current === run) setCodeLoading(false);
  };

  const closeCodeModal = () => {
    pollRun.current++; // stop polling
    setCodeLoading(false);
    setShowModal(false);
  };

  // Stop polling if the panel unmounts (customer leaves the page).
  useEffect(() => () => {
    pollRun.current++;
  }, []);

  // Renewal: open picker -> load plans -> choose -> confirm (debits wallet).
  const [renewOpen, setRenewOpen] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plans, setPlans] = useState<{ variantId: string; name: string; price: number }[]>([]);
  const [expired, setExpired] = useState(false);
  const [chosenPlan, setChosenPlan] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [renewDone, setRenewDone] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);

  const openRenew = async () => {
    setRenewOpen(true);
    setPlansLoading(true);
    setRenewError(null);
    setRenewDone(false);
    setChosenPlan(null);
    try {
      const res = await fetch(
        `/api/netflix/renew?orderItemId=${encodeURIComponent(orderItemId)}`,
        { cache: 'no-store' }
      );
      const d = await res.json();
      if (!res.ok) {
        setRenewError(d?.error || 'Could not load plans.');
      } else {
        setExpired(!!d.expired);
        setPlans(Array.isArray(d.plans) ? d.plans : []);
      }
    } catch {
      setRenewError('Could not load plans.');
    } finally {
      setPlansLoading(false);
    }
  };

  const confirmRenew = async () => {
    if (!chosenPlan) return;
    setSubmitting(true);
    setRenewError(null);
    try {
      const res = await fetch('/api/netflix/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId, variantId: chosenPlan }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setRenewDone(true);
      } else {
        setRenewError(d?.error || 'Could not submit the renewal.');
      }
    } catch {
      setRenewError('Could not submit the renewal.');
    } finally {
      setSubmitting(false);
    }
  };

  // Codes live ~15 min in the supplier link, then the API drops them. We
  // mirror that using the message's REAL arrival timestamp when the supplier
  // provides one (it does — the panel shows "13m ago"), and fall back to
  // when-we-first-saw-it only if a timestamp is missing.
  const CODE_TTL_MS = 15 * 60 * 1000;
  const [seenAt, setSeenAt] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  // Tick every 10s so expiry happens on its own.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  // Stamp first-seen time (fallback only — used when a message has no timestamp).
  useEffect(() => {
    const fresh = messages.map((m) => m.code || m.link).filter(Boolean) as string[];
    if (fresh.length === 0) return;
    setSeenAt((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of fresh) {
        if (!next[c]) {
          next[c] = Date.now();
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [messages]);

  // The moment a code arrived: the supplier's real timestamp, else first-seen.
  const arrivedAt = (m: Message): number | null => {
    if (m.timestamp && Number.isFinite(m.timestamp)) return m.timestamp;
    const key = m.code || m.link;
    return key ? seenAt[key] ?? null : null;
  };

  // A code shows only if (a) the latest fetch still returns it, AND
  // (b) it's within the 15-min window since it actually arrived.
  // Items to show: sign-in codes, and household / temporary-access emails,
  // which carry a confirm link instead of a number.
  const codes = messages.filter((m) => {
    if (!m.code && !m.link) return false;
    const t = arrivedAt(m);
    if (!t) return true; // just arrived this render; clock starts next tick
    return now - t < CODE_TTL_MS;
  });

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

          {note && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
              <p className="mb-0.5 text-[9px] uppercase tracking-[0.05em] text-amber-300/80">Note</p>
              <p className="whitespace-pre-wrap break-words text-[13px] text-amber-100">{note}</p>
            </div>
          )}

          {/* Codes */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-400">
              Verification code
            </p>

            <p className="mb-3 text-[12px] leading-relaxed text-slate-300">
              Household link နှင့် OTP login code များ ရယူရန် Get code or link ကိုနှိပ်ပေးပါ
            </p>

            <button
              type="button"
              onClick={getCode}
              disabled={codeLoading}
              className="w-full rounded-lg bg-emerald-500 px-3 py-2.5 text-[13px] font-bold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {codeLoading ? 'Code ကိုရယူနေပါသည်…' : 'Get code or link'}
            </button>

            {codes.length > 0 && (
              <div className="mt-3 space-y-2">
                {codes.map((m, i) => {
                  const t = arrivedAt(m);
                  const leftMs = t ? CODE_TTL_MS - (now - t) : CODE_TTL_MS;
                  const leftMin = Math.max(0, Math.ceil(leftMs / 60000));
                  return (
                    <div key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <CodeOrLink m={m} size="sm" />
                      <div className="mt-1 flex items-center justify-between">
                        {m.subject && <p className="text-[10px] text-slate-400">{m.subject}</p>}
                        <p className="ml-auto text-[10px] text-amber-300/80">⏳ {leftMin} min left</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Renewal */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
            <span className="text-[11px] text-slate-400">
              Subscription ending? Extend before it expires.
            </span>
            <button
              type="button"
              onClick={openRenew}
              className="flex-shrink-0 rounded-lg border border-amber-500/40 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/10"
            >
              သက်တမ်းတိုးမယ်
            </button>
          </div>

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
          onClick={closeCodeModal}
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
                {(() => {
                  const elapsed = waitStart ? Math.max(0, tick - waitStart) : 0;
                  const secs = Math.floor(elapsed / 1000);
                  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
                  // Fills over the usual 3 minutes, then holds near the end.
                  const pct = Math.min(95, (elapsed / (3 * 60_000)) * 95);
                  return (
                    <>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                        Netflix မှ code ရောက်လာရန် ၂-၃ မိနစ်ခန့် ကြာနိုင်ပါသည်။
                        <br />
                        Code ရောက်တာနဲ့ ဒီမှာ အလိုအလျောက် ပြပေးပါမည်။
                      </p>
                      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] text-slate-500">{mmss}</p>
                      {secs >= 150 && (
                        <p className="mt-1 text-[10px] text-amber-300/80">
                          နည်းနည်းပိုကြာနေပါတယ် — ခဏလေး ထပ်စောင့်ပေးပါ
                        </p>
                      )}
                    </>
                  );
                })()}
                <button
                  type="button"
                  onClick={closeCodeModal}
                  className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800"
                >
                  ပယ်ဖျက်မယ်
                </button>
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
                      <CodeOrLink m={m} size="lg" />
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
                  ၄ မိနစ်စောင့်ပေမယ့် code မရောက်လာသေးပါ။ Netflix ဖန်သားပြင်မှာ code တောင်းထားကြောင်း
                  သေချာပြီးမှ Get code or link ကို ထပ်နှိပ်ပေးပါ။ ဆက်မရပါက support ကို ဆက်သွယ်ပါ။
                </p>
                <button
                  type="button"
                  onClick={getCode}
                  className="mt-4 w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  ထပ်စမ်းမယ်
                </button>
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

      {/* Renewal plan picker modal */}
      {renewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => !submitting && setRenewOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {renewDone ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15">
                  <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-100">တောင်းဆိုမှု အောင်မြင်ပါသည်</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  ငွေဖြတ်တောက်ပြီးပါပြီ။ သင့်အကောင့်ကို မကြာမီ သက်တမ်းတိုးပေးပါမည်။ (ငြင်းပယ်ပါက ငွေပြန်အမ်းပါမည်။)
                </p>
                <button
                  type="button"
                  onClick={() => setRenewOpen(false)}
                  className="mt-4 w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  ပိတ်မယ်
                </button>
              </div>
            ) : plansLoading ? (
              <div className="flex flex-col items-center py-6 text-center">
                <svg className="mb-3 h-7 w-7 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                <p className="text-sm text-slate-300">Plan များ ရယူနေပါသည်…</p>
              </div>
            ) : expired ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/15">
                  <svg className="h-6 w-6 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-100">သက်တမ်းကုန်သွားပါပြီ</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  ဤအကောင့်သည် သက်တမ်းကုန်သွားသဖြင့် သက်တမ်းတိုး၍မရတော့ပါ။ အကောင့်အသစ် ဝယ်ယူပေးပါ။
                </p>
                <button
                  type="button"
                  onClick={() => setRenewOpen(false)}
                  className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  ပိတ်မယ်
                </button>
              </div>
            ) : (
              <>
                <p className="mb-1 text-sm font-semibold text-slate-100">Plan ရွေးချယ်ပါ</p>
                <p className="mb-4 text-[11px] text-slate-400">
                  ရွေးချယ်ပြီး အတည်ပြုပါက သင့် wallet မှ ငွေဖြတ်တောက်ပါမည်။
                </p>

                {renewError && (
                  <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-200">
                    {renewError}
                  </div>
                )}

                {plans.length === 0 ? (
                  <p className="text-xs text-slate-500">No plans available right now.</p>
                ) : (
                  <div className="space-y-2">
                    {plans.map((p) => (
                      <button
                        key={p.variantId}
                        type="button"
                        onClick={() => setChosenPlan(p.variantId)}
                        className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                          chosenPlan === p.variantId
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                              chosenPlan === p.variantId ? 'border-emerald-400' : 'border-slate-600'
                            }`}
                          >
                            {chosenPlan === p.variantId && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            )}
                          </span>
                          <span className="text-sm font-medium text-slate-100">{p.name}</span>
                        </span>
                        <span className="text-sm font-bold text-emerald-300">
                          {p.price.toLocaleString()} Ks
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRenewOpen(false)}
                    disabled={submitting}
                    className="flex-1 rounded-lg border border-slate-700 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    မလုပ်တော့ပါ
                  </button>
                  <button
                    type="button"
                    onClick={confirmRenew}
                    disabled={!chosenPlan || submitting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting && (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                      </svg>
                    )}
                    {submitting ? 'တင်နေသည်…' : 'အတည်ပြုမည်'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
