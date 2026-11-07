'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Yangon',
  });
}

function fmtBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(b >= 1e11 ? 0 : 1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}

function CopyBox({ value, tone = 'primary' }: { value: string; tone?: 'primary' | 'muted' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
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
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  const box =
    tone === 'primary'
      ? 'border-indigo-400/30 bg-indigo-500/15'
      : 'border-slate-700 bg-slate-900';
  return (
    <button
      type="button"
      onClick={copy}
      className={`group w-full rounded-2xl border ${box} p-4 text-left transition active:scale-[0.99]`}
    >
      <span className="block break-all font-mono text-[13px] leading-relaxed text-slate-100">{value}</span>
      <span
        className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
          copied ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-200 group-hover:bg-white/15'
        }`}
      >
        {copied ? '✓ Copied' : 'Tap to copy'}
      </span>
    </button>
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
  const barColor = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400';

  async function requestNewKey() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/vpn/${view.code}/replace`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (json?.ok) {
        setMsg({
          ok: true,
          text: 'Key အသစ် ရပါပြီ။ Outline: Disconnect လုပ်ပြီး ပြန် Connect လုပ်ပါ။ Hiddify/V2Box: Subscription ကို Update နှိပ်ပါ။ — New key ready.',
        });
        router.refresh();
      } else if (json?.error === 'limit') {
        setMsg({
          ok: false,
          text: 'ဒီလအတွက် Key အသစ်လဲခွင့် ၃ ကြိမ် ကုန်သွားပါပြီ။ PremiumCity သို့ ဆက်သွယ်ပါ။ — You used all 3 replacements this month. Please contact us.',
        });
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
    <div className="mx-auto max-w-md space-y-5 pb-10">
      {/* Header */}
      <div className="pt-2 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-400/30 bg-indigo-500/15 text-2xl shadow-[0_0_40px_-10px_rgba(99,102,241,0.6)]">
          🔑
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">Your VPN Key</h1>
        <p className="mt-1 text-sm text-slate-400">PremiumCity Outline VPN</p>
      </div>

      {/* Key */}
      <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
        {/* Which app does the customer use? */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-950/70 p-1 text-sm">
          {(['outline', 'other'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setApp(a)}
              className={`rounded-xl py-2 font-semibold transition ${
                app === a ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {a === 'outline' ? 'Outline' : 'Hiddify · V2Box · others'}
            </button>
          ))}
        </div>

        {app === 'outline' ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Outline key · auto-updates</p>
              <a
                href={view.dynamicKey}
                className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                Open in Outline
              </a>
            </div>
            <CopyBox value={view.dynamicKey} />
            <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[13px] leading-relaxed text-slate-300">
              ဤ Key ကို Outline App ထဲ <b>တစ်ကြိမ်သာ</b> ထည့်ပါ။ Server ပြောင်းသည့်အခါ အလိုအလျောက် ပြောင်းသွားပါမည်။
              <span className="mt-1 block text-slate-500">
                Add this key to Outline once. When we change servers it updates by itself.
              </span>
            </p>

            {view.ssUri && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowBackup((v) => !v)}
                  className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  {showBackup ? 'Hide' : 'Show'} backup key (ss://) for old Outline apps
                </button>
                {showBackup && (
                  <div className="mt-2 space-y-2">
                    <CopyBox value={view.ssUri} tone="muted" />
                    <p className="text-[12px] text-slate-500">
                      Backup key changes when the server changes — copy it again from this page if it stops working.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subscription link</p>
              <a
                href={`hiddify://import/${view.subscriptionLink}#PremiumCity`}
                className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                Open in Hiddify
              </a>
            </div>
            <CopyBox value={view.subscriptionLink} />
            <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[13px] leading-relaxed text-slate-300">
              <p>
                App ထဲတွင် <b>Subscription</b> (Add profile / Add subscription) အဖြစ် ထည့်ပါ။ Server ပြောင်းလျှင်{' '}
                <b>Update</b> ကိုနှိပ်ပါ (သို့) ၁ နာရီအတွင်း အလိုအလျောက် ပြောင်းသွားပါမည်။
              </p>
              <p className="text-slate-500">
                Add as a subscription in Hiddify, V2Box, v2rayNG or Shadowrocket. After a server change, tap Update
                (it also updates by itself within 1 hour).
              </p>
            </div>
          </>
        )}
      </section>

      {/* Plan */}
      <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold text-slate-50">{view.planName || 'VPN plan'}</p>
            <p className="mt-0.5 text-sm text-slate-400">
              {view.serverName ? `${view.serverName} · ` : ''}
              {flag} {countryName}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">Start date</p>
            <p className="mt-1 font-semibold text-slate-100">{fmtDate(view.startsAt)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">End date</p>
            <p className="mt-1 font-semibold text-slate-100">{fmtDate(view.expiresAt)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
          <span className="text-sm text-slate-400">Days remaining</span>
          <span className={`text-xl font-bold ${view.daysRemaining <= 3 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {view.daysRemaining} {view.daysRemaining === 1 ? 'day' : 'days'}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Data usage</span>
            <span className="text-sm">
              <b className="text-slate-100">{fmtBytes(view.usedBytes)}</b>
              <span className="text-slate-500"> / {limit > 0 ? fmtBytes(limit) : 'Unlimited'}</span>
            </span>
          </div>
          {limit > 0 && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                <span>{view.periodResetsAt ? `Resets ${fmtDate(view.periodResetsAt)}` : ''}</span>
                <span>{pct.toFixed(0)}% used</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Request new key */}
      <section className="space-y-3 rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <p className="font-semibold text-slate-100">လိုင်းမကောင်းပါသလား?</p>
          <p className="text-sm text-slate-400">
            Line not working? Get a new key. {view.replacementsLeft} of 3 left this month.
          </p>
        </div>

        <button
          type="button"
          disabled={busy || view.replacementsLeft <= 0}
          onClick={() => setConfirming(true)}
          className="w-full rounded-2xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Key အသစ် ပြုလုပ်နေပါသည်…' : 'Key အသစ်လဲမယ် · Request new key'}
        </button>

        {confirming && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={() => !busy && setConfirming(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl">
                ⚠️
              </div>
              <h2 className="text-center text-lg font-bold text-slate-50">Key အသစ် လဲလှယ်ရန်</h2>
              <p className="mt-3 text-center text-[15px] leading-relaxed text-slate-200">
                Server overload ဖြစ်ခြင်းမှ ကာကွယ်ရန် တစ်လအတွင်း <b>သုံးကြိမ်သာ</b> လဲလှယ်ခွင့်ရှိပါသည်။
              </p>
              <p className="mt-2 text-center text-sm text-amber-300">
                ယခုလ {view.replacementsLeft} ကြိမ် ကျန်ပါသည်
              </p>
              <p className="mt-3 rounded-xl bg-slate-950/70 p-2.5 text-center text-xs leading-relaxed text-slate-400">
                Key မလဲမီ Outline ကို Disconnect လုပ်ပြီး ပြန် Connect လုပ်ကြည့်ပါ။
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="rounded-xl border border-slate-700 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  မလုပ်ပါ
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={requestNewKey}
                  className="rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
                >
                  {busy ? 'ခဏစောင့်ပါ…' : 'သဘောတူပါသည်'}
                </button>
              </div>
            </div>
          </div>
        )}

        {msg && (
          <p
            className={`rounded-xl p-3 text-sm ${
              msg.ok ? 'bg-emerald-500/10 text-emerald-200' : 'bg-rose-500/10 text-rose-200'
            }`}
          >
            {msg.text}
          </p>
        )}
      </section>
    </div>
  );
}
