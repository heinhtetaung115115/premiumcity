'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import type { VpnStatusView } from '@/lib/vpn';

const FLAGS: Record<string, string> = {
  JP: '🇯🇵', SG: '🇸🇬', TH: '🇹🇭', US: '🇺🇸', HK: '🇭🇰', KR: '🇰🇷', DE: '🇩🇪', GB: '🇬🇧', UK: '🇬🇧',
  IN: '🇮🇳', ID: '🇮🇩', MY: '🇲🇾', VN: '🇻🇳', TW: '🇹🇼', AU: '🇦🇺', NL: '🇳🇱', FR: '🇫🇷',
};
const COUNTRY_NAMES: Record<string, string> = {
  JP: 'Japan', SG: 'Singapore', TH: 'Thailand', US: 'United States', HK: 'Hong Kong', KR: 'Korea',
  DE: 'Germany', GB: 'United Kingdom', UK: 'United Kingdom', IN: 'India', ID: 'Indonesia',
  MY: 'Malaysia', VN: 'Vietnam', TW: 'Taiwan', AU: 'Australia', NL: 'Netherlands', FR: 'France',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Yangon' });
}

function fmtBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(b >= 1e11 ? 0 : 1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

/** Key / link field: shows the value, one big copy button underneath. */
function KeyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      <p className="max-h-24 overflow-y-auto break-all px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-200">
        {value}
      </p>
      <button
        type="button"
        onClick={async () => {
          await copyText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className={`flex w-full items-center justify-center gap-2 border-t border-white/10 py-3 text-sm font-semibold transition ${
          copied ? 'bg-emerald-500/15 text-emerald-300' : 'text-white hover:bg-white/5'
        }`}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied · ကူးပြီးပါပြီ' : 'Copy · ကူးမည်'}
      </button>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-slate-200">
        {n}
      </span>
      <span className="text-[13px] leading-relaxed text-slate-300">{children}</span>
    </li>
  );
}

/** Circular data meter. */
function DataRing({ pct, color }: { pct: number; color: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (c * Math.min(100, pct)) / 100}
      />
    </svg>
  );
}

export function VpnStatusClient({ view }: { view: VpnStatusView }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [app, setApp] = useState<'outline' | 'other'>('outline');

  const country = (view.country || '').toUpperCase();
  const flag = FLAGS[country] ?? '🌐';
  const countryName = COUNTRY_NAMES[country] ?? view.country ?? '';
  const limit = view.dataLimitBytes;
  const pct = limit > 0 ? Math.min(100, (view.usedBytes / limit) * 100) : 0;
  const ringColor = pct >= 90 ? '#fb7185' : pct >= 70 ? '#fbbf24' : '#34d399';

  const start = new Date(view.startsAt).getTime();
  const end = new Date(view.expiresAt).getTime();
  const timePct = end > start ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0;
  const lowDays = view.daysRemaining <= 3;

  async function requestNewKey() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/vpn/${view.code}/replace`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (json?.ok) {
        setMsg({
          ok: true,
          text: 'Key အသစ် ရပါပြီ။ Outline: Disconnect လုပ်ပြီး ပြန် Connect လုပ်ပါ။ Hiddify/V2Box: Subscription ကို Update နှိပ်ပါ။',
        });
        router.refresh();
      } else if (json?.error === 'limit') {
        setMsg({ ok: false, text: 'ဒီလအတွက် Key အသစ်လဲခွင့် ၃ ကြိမ် ကုန်သွားပါပြီ။ PremiumCity သို့ ဆက်သွယ်ပါ။' });
      } else {
        setMsg({ ok: false, text: json?.error || 'Something went wrong. Please try again.' });
      }
    } catch {
      setMsg({ ok: false, text: 'Network error. Please try again.' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-12">
      {/* ── Plan hero ─────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-indigo-600/30 via-slate-900 to-slate-950 p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-200/80">
              <ShieldCheck className="h-4 w-4" /> PremiumCity VPN
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Active
            </span>
          </div>

          <h1 className="mt-4 text-[22px] font-bold leading-tight text-white">{view.planName || 'VPN plan'}</h1>
          <p className="mt-1 text-sm text-slate-300">
            {flag} {countryName}
            {view.serverName ? <span className="text-slate-500"> · {view.serverName}</span> : null}
          </p>

          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className={`text-4xl font-bold tabular-nums ${lowDays ? 'text-amber-300' : 'text-white'}`}>
                {view.daysRemaining}
              </p>
              <p className="text-xs text-slate-400">
                {view.daysRemaining === 1 ? 'day' : 'days'} left · ရက် ကျန်ပါသည်
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              <p className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Ends
              </p>
              <p className="text-sm font-semibold text-slate-100">{fmtDate(view.expiresAt)}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${lowDays ? 'bg-amber-400' : 'bg-indigo-400'}`}
              style={{ width: `${timePct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
            <span>{fmtDate(view.startsAt)}</span>
            <span>{fmtDate(view.expiresAt)}</span>
          </div>
        </div>
      </section>

      {/* ── Data ──────────────────────────────────────── */}
      <section className="flex items-center gap-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4">
        <div className="relative flex-shrink-0">
          <DataRing pct={limit > 0 ? pct : 0} color={ringColor} />
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
            {limit > 0 ? `${pct.toFixed(0)}%` : '∞'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-slate-500">Data used · အသုံးပြုပြီး</p>
          <p className="mt-1 text-xl font-bold text-white">
            {fmtBytes(view.usedBytes)}
            <span className="text-base font-medium text-slate-500"> / {limit > 0 ? fmtBytes(limit) : 'Unlimited'}</span>
          </p>
          {limit > 0 && (
            <p className="mt-0.5 text-xs text-slate-400">
              {fmtBytes(Math.max(0, limit - view.usedBytes))} left
              {view.periodResetsAt ? ` · resets ${fmtDate(view.periodResetsAt)}` : ''}
            </p>
          )}
        </div>
      </section>

      {/* ── Connect ───────────────────────────────────── */}
      <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/70 p-4">
        <div>
          <p className="flex items-center gap-2 text-base font-semibold text-white">
            <Smartphone className="h-4 w-4 text-indigo-300" /> Connect
          </p>
          <p className="mt-1 text-sm text-slate-300">မိမိ အသုံးပြုမည့် App ကို ရွေးချယ်ပါ</p>
          <p className="text-xs text-slate-500">Choose the app you use</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: 'outline', title: 'Outline', sub: 'Outline app' },
              { id: 'other', title: 'Others', sub: 'Hiddify · V2Box · v2rayNG' },
            ] as const
          ).map((o) => {
            const on = app === o.id;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setApp(o.id)}
                className={`rounded-2xl border px-3 py-2.5 text-left transition ${
                  on
                    ? 'border-indigo-400/60 bg-indigo-500/15 ring-1 ring-indigo-400/30'
                    : 'border-white/10 bg-black/20 hover:border-white/20'
                }`}
              >
                <span className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${on ? 'text-white' : 'text-slate-300'}`}>{o.title}</span>
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      on ? 'border-indigo-300 bg-indigo-400' : 'border-slate-600'
                    }`}
                  >
                    {on && <Check className="h-3 w-3 text-slate-950" strokeWidth={3} />}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{o.sub}</span>
              </button>
            );
          })}
        </div>

        {app === 'outline' ? (
          <div className="space-y-3">
            <KeyField value={view.dynamicKey} />
            <a
              href={view.dynamicKey}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
            >
              <ExternalLink className="h-4 w-4" /> Open in Outline
            </a>
            <ol className="space-y-2 pt-1">
              <Step n={1}>Key ကို Copy ကူးပါ (သို့) “Open in Outline” ကိုနှိပ်ပါ</Step>
              <Step n={2}>Outline App တွင် ＋ နှိပ်ပြီး Key ကို ထည့်ပါ</Step>
              <Step n={3}>
                Connect နှိပ်ပါ။ <b>တစ်ကြိမ်သာ ထည့်ရန်လိုပါသည်</b> — Server ပြောင်းလျှင် အလိုအလျောက် ပြောင်းပါမည်
              </Step>
            </ol>
            {view.ssUri && (
              <div className="border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowBackup((v) => !v)}
                  className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  {showBackup ? 'Hide' : 'Show'} backup key (ss://) for old Outline versions
                </button>
                {showBackup && (
                  <div className="mt-2 space-y-1.5">
                    <KeyField value={view.ssUri} />
                    <p className="text-[11px] text-slate-500">
                      This key changes when the server changes — copy it again from this page.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <KeyField value={view.subscriptionLink} />
            <a
              href={`hiddify://import/${view.subscriptionLink}#PremiumCity`}
              className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 py-3 text-sm font-bold text-white transition hover:bg-indigo-400"
            >
              <ExternalLink className="h-4 w-4" /> Open in Hiddify
            </a>
            <ol className="space-y-2 pt-1">
              <Step n={1}>Link ကို Copy ကူးပါ</Step>
              <Step n={2}>
                App ထဲတွင် <b>Add subscription</b> / <b>Import from clipboard</b> ကိုနှိပ်ပါ
              </Step>
              <Step n={3}>
                Server ပြောင်းလျှင် Subscription ကို <b>Update</b> နှိပ်ပါ (သို့) ၁ နာရီအတွင်း အလိုအလျောက် ပြောင်းပါမည်
              </Step>
            </ol>
          </div>
        )}
      </section>

      {/* ── Line problem ──────────────────────────────── */}
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-white">လိုင်းမကောင်းပါသလား?</p>
            <p className="mt-0.5 text-xs text-slate-400">Line not working? Get a new key.</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1" title={`${view.replacementsLeft} of 3 left this month`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`h-2 w-5 rounded-full ${i < view.replacementsLeft ? 'bg-amber-400' : 'bg-white/10'}`}
              />
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">ယခုလ {view.replacementsLeft}/3 ကြိမ် ကျန်ပါသည်</p>

        <button
          type="button"
          disabled={busy || view.replacementsLeft <= 0}
          onClick={() => setConfirming(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 py-3 text-sm font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Key အသစ် ပြုလုပ်နေပါသည်…' : 'Key အသစ်လဲမယ်'}
        </button>

        {msg && (
          <p
            className={`mt-3 rounded-2xl p-3 text-sm leading-relaxed ${
              msg.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'
            }`}
          >
            {msg.text}
          </p>
        )}
      </section>

      <p className="text-center text-xs text-slate-600">PremiumCity · pcitystore.com</p>

      {/* ── Confirm popup ─────────────────────────────── */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => !busy && setConfirming(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-sm rounded-[28px] border border-white/10 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15">
              <AlertTriangle className="h-6 w-6 text-amber-300" />
            </div>
            <h2 className="text-center text-lg font-bold text-white">Key အသစ် လဲလှယ်ရန်</h2>
            <p className="mt-3 text-center text-[15px] leading-relaxed text-slate-200">
              Server overload ဖြစ်ခြင်းမှ ကာကွယ်ရန် တစ်လအတွင်း <b>သုံးကြိမ်သာ</b> လဲလှယ်ခွင့်ရှိပါသည်။
            </p>
            <p className="mt-2 text-center text-sm font-medium text-amber-300">
              ယခုလ {view.replacementsLeft} ကြိမ် ကျန်ပါသည်
            </p>
            <p className="mt-3 rounded-xl bg-black/30 p-2.5 text-center text-xs leading-relaxed text-slate-400">
              Key မလဲမီ Disconnect လုပ်ပြီး ပြန် Connect လုပ်ကြည့်ပါ။
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="rounded-2xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                မလုပ်ပါ
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={requestNewKey}
                className="rounded-2xl bg-amber-400 py-3 text-sm font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
              >
                {busy ? 'ခဏစောင့်ပါ…' : 'သဘောတူပါသည်'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
