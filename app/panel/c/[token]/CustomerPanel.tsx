'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, ShieldCheck, Timer, User, ExternalLink, Inbox } from 'lucide-react';

type Msg = { id: string; subject: string; code: string | null; link: string | null; receivedAt: string; snippet: string; html?: string };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Yangon' });
}
function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}
async function copyText(v: string) {
  try {
    await navigator.clipboard.writeText(v);
  } catch {
    const t = document.createElement('textarea');
    t.value = v;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

function Field({ icon, label, value, secret = false }: { icon: React.ReactNode; label: string; value: string; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-slate-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate font-mono text-[15px] text-white">{shown ? value : '•'.repeat(Math.min(12, value.length || 8))}</p>
      </div>
      {secret && (
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label={shown ? 'Hide' : 'Show'}
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          await copyText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
          copied ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.06] text-slate-200 hover:bg-white/10'
        }`}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function CustomerPanel(props: {
  token: string;
  serviceName: string;
  serviceColor: string;
  email: string;
  password: string;
  profile: string | null;
  pin: string | null;
  warrantyUntil: string;
  createdAt: string;
  passwordUpdatedAt: string | null;
  customerName: string | null;
}) {
  const [phase, setPhase] = useState<'idle' | 'waiting' | 'shown' | 'error'>('idle');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [err, setErr] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [openMail, setOpenMail] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(0);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const end = new Date(props.warrantyUntil).getTime();
  const start = new Date(props.createdAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
  const pct = end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0;
  const pwRecent = props.passwordUpdatedAt && Date.now() - new Date(props.passwordUpdatedAt).getTime() < 7 * 86_400_000;

  async function poll() {
    try {
      const res = await fetch(`/api/panel/codes/${props.token}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(json?.error || 'Could not check right now. Please try again.');
        setPhase('error');
        return;
      }
      const list: Msg[] = Array.isArray(json.messages) ? json.messages : [];
      if (list.length) {
        setMsgs(list);
        setPhase('shown');
        return;
      }
      if (Date.now() - started.current < 90_000) {
        timer.current = setTimeout(poll, 5000);
      } else {
        setPhase('error');
        setErr('Code မရောက်သေးပါ။ App ထဲမှ Code ထပ်ပို့ခိုင်းပြီး ပြန်နှိပ်ပါ။');
      }
    } catch {
      setErr('Network error. Please try again.');
      setPhase('error');
    }
  }

  function getCode() {
    if (timer.current) clearTimeout(timer.current);
    setErr('');
    setMsgs([]);
    setPhase('waiting');
    started.current = Date.now();
    poll();
  }

  return (
    <main className="mx-auto max-w-md space-y-4 px-4 pb-14 pt-8">
      {/* Header */}
      <header className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5">
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
          style={{ background: `${props.serviceColor}33` }}
        />
        <div className="relative flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black text-white"
            style={{ background: props.serviceColor }}
          >
            {props.serviceName.slice(0, 1)}
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">{props.serviceName}</h1>
            <p className="text-xs text-slate-400">{props.customerName ? `For ${props.customerName}` : 'Your account'}</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" /> Active
          </span>
        </div>

        <div className="relative mt-5 flex items-end justify-between">
          <div>
            <p className={`text-4xl font-bold tabular-nums ${daysLeft <= 3 ? 'text-amber-300' : 'text-white'}`}>{daysLeft}</p>
            <p className="text-xs text-slate-400">days left · ရက် ကျန်ပါသည်</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Expires</p>
            <p className="text-sm font-semibold text-white">{fmtDate(props.warrantyUntil)}</p>
          </div>
        </div>
        <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${daysLeft <= 3 ? 'bg-amber-400' : 'bg-indigo-400'}`} style={{ width: `${pct}%` }} />
        </div>
      </header>

      {/* Password changed notice */}
      {pwRecent && props.passwordUpdatedAt && (
        <div className="flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-3.5">
          <KeyRound className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <p className="text-[13px] leading-relaxed text-amber-100">
            Password ကို {fmtDate(props.passwordUpdatedAt)} တွင် ပြောင်းထားပါသည်။ အောက်ပါ Password အသစ်ကို အသုံးပြုပါ။
            <span className="block text-xs text-amber-200/70">Password was updated — use the new one below.</span>
          </p>
        </div>
      )}

      {/* Login details */}
      <section className="space-y-2.5 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
        <p className="px-1 text-sm font-semibold text-white">Login details</p>
        <Field icon={<Mail className="h-4 w-4" />} label="Email" value={props.email} />
        <Field icon={<KeyRound className="h-4 w-4" />} label="Password" value={props.password} secret />
        {props.profile && <Field icon={<User className="h-4 w-4" />} label="Profile" value={props.profile} />}
        {props.pin && <Field icon={<KeyRound className="h-4 w-4" />} label="PIN" value={props.pin} secret />}
        <p className="px-1 pt-1 text-[12px] leading-relaxed text-slate-500">
          Password / Email ကို မပြောင်းပါနှင့်။ ပြောင်းပါက Warranty ပျက်ပါမည်။
        </p>
      </section>

      {/* Codes */}
      <section className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.02] p-4">
        <div>
          <p className="text-sm font-semibold text-white">Login code / Verification</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
            App ထဲမှ Code ပို့ခိုင်းပြီးမှ အောက်က ခလုတ်ကို နှိပ်ပါ။
            <span className="block text-xs text-slate-500">Request the code in the app first, then tap below.</span>
          </p>
        </div>

        {phase !== 'waiting' && (
          <button
            type="button"
            onClick={getCode}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition hover:brightness-110 active:scale-[0.99]"
            style={{ background: props.serviceColor === '#ffffff' ? '#6366f1' : props.serviceColor }}
          >
            <Inbox className="h-4 w-4" /> {phase === 'shown' ? 'Check again' : 'Get code'}
          </button>
        )}

        {phase === 'waiting' && (
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-center">
            <style>{`@keyframes pcpulse{0%,100%{transform:scale(.9);opacity:.5}50%{transform:scale(1.1);opacity:1}}`}</style>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/15" style={{ animation: 'pcpulse 1.6s ease-in-out infinite' }}>
              <Timer className="h-6 w-6 text-indigo-300" />
            </div>
            <p className="mt-3 text-sm font-semibold text-white">Code ကို စောင့်နေပါသည်…</p>
            <p className="text-xs text-slate-500">Waiting for the email · up to 90 seconds</p>
          </div>
        )}

        {phase === 'shown' &&
          msgs.map((m) => (
            <div key={m.id} className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] p-4">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate pr-2">{m.subject}</span>
                <span className="flex-shrink-0">{ago(m.receivedAt)}</span>
              </div>
              {m.code && (
                <button
                  type="button"
                  onClick={async () => {
                    await copyText(m.code as string);
                    setCopiedCode(m.id);
                    setTimeout(() => setCopiedCode(null), 1500);
                  }}
                  className="mt-2 flex w-full items-center justify-between rounded-xl bg-black/30 px-4 py-3"
                >
                  <span className="font-mono text-3xl font-bold tracking-[0.25em] text-white">{m.code}</span>
                  <span className="text-xs font-semibold text-emerald-300">{copiedCode === m.id ? 'Copied ✓' : 'Copy'}</span>
                </button>
              )}
              {m.link && (
                <a
                  href={m.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-400 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-300"
                >
                  <ExternalLink className="h-4 w-4" /> Verify · This was me
                </a>
              )}
              {!m.code && !m.link && !m.html && <p className="mt-2 text-xs leading-relaxed text-slate-300">{m.snippet}</p>}
              {m.html && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenMail((v) => (v === m.id ? null : m.id))}
                    className={`mt-2 w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                      !m.code && !m.link
                        ? 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
                        : 'border border-white/10 text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    {openMail === m.id ? 'Hide email' : 'Email ကိုဖွင့်ကြည့်မည် · View email'}
                  </button>
                  {openMail === m.id && (
                    <div className="mt-2 overflow-hidden rounded-xl bg-white">
                      <iframe
                        title={m.subject}
                        srcDoc={`<base target="_blank">${m.html}`}
                        sandbox="allow-popups allow-popups-to-escape-sandbox"
                        className="h-[560px] w-full border-0 bg-white"
                      />
                    </div>
                  )}
                  {openMail === m.id && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                      “This was me” ကိုသာ နှိပ်ပါ။ အကောင့်လုံခြုံရေးအတွက် အချို့ Link များကို ပိတ်ထားပါသည်။
                    </p>
                  )}
                </>
              )}
            </div>
          ))}

        {phase === 'error' && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200">{err}</p>}
      </section>

      <p className="text-center text-[11px] text-slate-600">Valid until {fmtDate(props.warrantyUntil)}</p>
    </main>
  );
}
