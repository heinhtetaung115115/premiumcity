'use client';

// Orders page card for accounts delivered from the account panel
// (Crunchyroll profiles…). Same layout idea as the Netflix card: details,
// expiry, and a Get code button — everything inside the store.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimeStyles, Mascot } from '@/components/AnimeTheme';

type Msg = { id: string; subject: string; code: string | null; link: string | null; receivedAt: string; html?: string };
type View = {
  service: string;
  serviceName: string;
  color: string;
  live: boolean;
  warrantyUntil: string;
  linkUrl: string;
  email?: string;
  password?: string;
  profile?: string | null;
  pin?: string | null;
  passwordUpdatedAt?: string | null;
  messages?: Msg[];
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Yangon' });
}

function Copy({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="flex-shrink-0 rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:border-orange-400/60 hover:text-orange-200"
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Row({ label, value, copy = true, secret = false }: { label: string; value: string; copy?: boolean; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  return (
    <div>
      <p className="mb-1 text-[9px] uppercase tracking-[0.05em] text-slate-500">{label}</p>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <span className="min-w-0 break-all font-mono text-[13px] text-slate-100">{shown ? value : '••••'}</span>
        <span className="flex flex-shrink-0 items-center gap-1.5">
          {secret && (
            <button
              type="button"
              onClick={() => setShown((v) => !v)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/5"
            >
              {shown ? 'Hide' : 'Show'}
            </button>
          )}
          {copy && <Copy value={value} />}
        </span>
      </div>
    </div>
  );
}

export function AccountPanelCard({ orderItemId }: { orderItemId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [openMail, setOpenMail] = useState<string | null>(null);
  const run = useRef(0);

  const load = useCallback(
    async (codes: boolean): Promise<View | null> => {
      try {
        const res = await fetch(`/api/account-panel?orderItemId=${encodeURIComponent(orderItemId)}${codes ? '&codes=1' : ''}`, {
          cache: 'no-store',
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(d?.error || `Could not load the account (error ${res.status}).`);
          return null;
        }
        setView(d);
        setError(null);
        return d as View;
      } catch {
        setError('Could not load the account.');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [orderItemId]
  );

  useEffect(() => {
    load(false);
    return () => {
      run.current++;
    };
  }, [load]);

  async function getCode() {
    const my = ++run.current;
    setModal(true);
    setWaiting(true);
    setMsgs([]);
    setOpenMail(null);
    const started = Date.now();
    const minShow = new Promise((r) => setTimeout(r, 1800));
    while (run.current === my) {
      const v = await load(true);
      const list = v?.messages ?? [];
      if (list.length) {
        await minShow;
        if (run.current !== my) return;
        setMsgs(list);
        setWaiting(false);
        return;
      }
      if (Date.now() - started > 90_000) break;
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (run.current === my) setWaiting(false);
  }

  function closeModal() {
    run.current++;
    setModal(false);
    setWaiting(false);
  }

  const isCr = view?.service === 'crunchyroll';
  const accent = view?.color && view.color !== '#ffffff' ? view.color : '#f47521';
  const daysLeft = view ? Math.max(0, Math.ceil((new Date(view.warrantyUntil).getTime() - Date.now()) / 86_400_000)) : 0;

  return (
    <div
      className="mt-3 overflow-hidden rounded-2xl border p-4"
      style={{ borderColor: `${accent}40`, background: `linear-gradient(135deg, ${accent}17, transparent 70%)` }}
    >
      {isCr && <AnimeStyles />}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black text-white" style={{ background: accent }}>
          {(view?.serviceName || 'A').slice(0, 1)}
        </span>
        <span className="text-xs font-semibold" style={{ color: accent }}>
          Your {view?.serviceName || ''} account
        </span>
        {view?.live && (
          <span className="ml-auto rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">Active</span>
        )}
      </div>

      {loading && <p className="text-xs text-slate-400">Loading account…</p>}
      {!loading && error && !view && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-3 text-xs text-amber-100">{error}</div>
      )}

      {view && !view.live && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-300">
          သက်တမ်း ကုန်ဆုံးသွားပါပြီ ({fmtDate(view.warrantyUntil)})။ သက်တမ်းတိုးရန် ဆက်သွယ်ပါ။
        </div>
      )}

      {view?.live && (
        <div className="space-y-2">
          {view.email && <Row label="Email" value={view.email} />}
          {view.password && <Row label="Password" value={view.password} />}
          {view.passwordUpdatedAt && (
            <p className="-mt-1 px-1 text-[10px] text-slate-500">Password last updated {fmtDate(view.passwordUpdatedAt)}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {view.profile && <Row label="Profile" value={view.profile} copy={false} />}
            {view.pin && <Row label="PIN" value={view.pin} copy={false} secret />}
          </div>
          <div>
            <p className="mb-1 text-[9px] uppercase tracking-[0.05em] text-slate-500">Expires</p>
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
              <span className="font-mono text-[13px] text-slate-100">{fmtDate(view.warrantyUntil)}</span>
              <span className={`text-[11px] font-semibold ${daysLeft <= 3 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {daysLeft} days left
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <p className="mb-3 text-[12px] leading-relaxed text-slate-300">
              Login ဝင်တဲ့အခါ Email confirm လိုတာပဲ ဖြစ်ဖြစ်၊ OTP လိုတာပဲ ဖြစ်ဖြစ် အောက်က <b className="text-white">Get code</b>{' '}
              ကိုနှိပ်ပြီး ကျလာတဲ့ Email မှာ <b className="text-emerald-300">This was me</b> ကို နှိပ်ပေးပါ။
            </p>
            <button
              type="button"
              onClick={getCode}
              className="w-full rounded-lg px-3 py-2.5 text-[13px] font-bold text-white transition hover:brightness-110"
              style={{ background: accent }}
            >
              Get code
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] text-slate-500">⚠ Password / Email ကို မပြောင်းပါနှင့်။</p>
            <a href={view.linkUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-slate-400 hover:text-white">
              Open full page ↗
            </a>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center" onClick={closeModal}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {waiting ? (
              <div className="py-4 text-center">
                <div className="flex justify-center">
                  {isCr ? (
                    <Mascot mood="search" size={110} />
                  ) : (
                    <span className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-orange-400" />
                  )}
                </div>
                <p className="mt-3 text-sm font-semibold text-white">Email ကို ရှာနေပါတယ်…</p>
                <p className="text-xs text-slate-500">Up to 90 seconds · Request the code in the app first</p>
              </div>
            ) : msgs.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-semibold text-white">Code မရောက်သေးပါ</p>
                <p className="mt-1 text-xs text-slate-400">App ထဲမှ Code ထပ်ပို့ခိုင်းပြီး ပြန်နှိပ်ပါ။</p>
                <button type="button" onClick={getCode} className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ background: accent }}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {isCr && (
                  <div className="flex justify-center">
                    <Mascot mood="happy" size={80} />
                  </div>
                )}
                {msgs.map((m) => (
                  <div key={m.id} className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-3">
                    <p className="truncate text-[11px] text-slate-400">{m.subject}</p>
                    {m.code && (
                      <div className="mt-2 flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
                        <span className="font-mono text-2xl font-bold tracking-widest text-white">{m.code}</span>
                        <Copy value={m.code} />
                      </div>
                    )}
                    {m.link && (
                      <a
                        href={m.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block rounded-xl bg-emerald-400 py-2.5 text-center text-sm font-bold text-slate-950 hover:bg-emerald-300"
                      >
                        Verify · This was me
                      </a>
                    )}
                    {m.html && (
                      <>
                        <button
                          type="button"
                          onClick={() => setOpenMail((v) => (v === m.id ? null : m.id))}
                          className="mt-2 w-full rounded-xl border border-white/10 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
                        >
                          {openMail === m.id ? 'Hide email' : 'Email ကိုဖွင့်ကြည့်မည် · View email'}
                        </button>
                        {openMail === m.id && (
                          <div className="mt-2 overflow-hidden rounded-xl bg-white">
                            <iframe
                              title={m.subject}
                              srcDoc={`<base target="_blank">${m.html}`}
                              sandbox="allow-popups allow-popups-to-escape-sandbox"
                              className="h-[480px] w-full border-0 bg-white"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
                <p className="text-center text-[11px] text-slate-500">“This was me” ကိုသာ နှိပ်ပါ။</p>
              </div>
            )}
            <button type="button" onClick={closeModal} className="mt-4 w-full rounded-xl border border-white/10 py-2 text-xs text-slate-300 hover:bg-white/5">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
