'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CityBot from '@/components/CityBot';

const LATE_AFTER_MS = 8 * 3600 * 1000;

function elapsedLabel(ms: number) {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins} မိနစ်`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} နာရီ ${m} မိနစ်` : `${h} နာရီ`;
}

/** Shown on a manual order that has not been delivered yet. */
export default function ManualOrderWaiting({ orderId, createdAt }: { orderId: string; createdAt?: string | null }) {
  const router = useRouter();
  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  // Time is only read in the browser (avoids server/client mismatch).
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const age = now != null && Number.isFinite(created) ? now - created : null;
  const late = age != null && age >= LATE_AFTER_MS;

  async function contactAdmin() {
    if (busy) return;
    setBusy(true);
    try {
      // Server sends the admin one Telegram message per order; repeats are ignored.
      await fetch(`/api/orders/${encodeURIComponent(orderId)}/nudge`, { method: 'POST', keepalive: true });
    } catch {
      /* still take them to support */
    }
    router.push('/contact');
  }

  if (late) {
    return (
      <div className="mt-3 flex flex-col items-center rounded-2xl border border-amber-500/30 bg-[radial-gradient(120%_80%_at_50%_0%,#2a2210_0%,#0b1324_70%)] px-4 pb-5 pt-2 text-center">
        <CityBot pose="oops" size={130} label="City Bot" />
        <p className="text-[17px] font-semibold text-slate-50">ပုံမှန်ထက် ကြာနေပါတယ်</p>
        <p className="mt-0.5 text-[12.5px] text-slate-400">Your order is taking longer than usual</p>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-200">
          8 နာရီ ကျော်သွားပါပြီ။ Admin ကို ဆက်သွယ်ပေးပါ၊ ချက်ချင်း စစ်ပေးပါမယ်။
        </p>
        <button
          type="button"
          onClick={contactAdmin}
          disabled={busy}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-[15px] font-bold text-amber-950 transition hover:bg-amber-400 active:scale-[0.98] disabled:opacity-70"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" strokeLinejoin="round" />
          </svg>
          Admin ကို ဆက်သွယ်မယ်
        </button>
        {age != null && <p className="mt-3 text-xs text-slate-500">Order တင်ထားတာ {elapsedLabel(age)} ရှိပါပြီ</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col items-center rounded-2xl border border-emerald-500/25 bg-[radial-gradient(120%_80%_at_50%_0%,#13233f_0%,#0b1324_70%)] px-4 pb-5 pt-2 text-center">
      <CityBot pose="seal" size={170} label="City Bot is packing your order" />
      <p className="text-[17px] font-semibold text-slate-50">
        သင့် order ကို ပြင်ဆင်နေပါတယ်
        <span className="cb-dot">.</span>
        <span className="cb-dot" style={{ animationDelay: '.2s' }}>.</span>
        <span className="cb-dot" style={{ animationDelay: '.4s' }}>.</span>
      </p>
      <p className="mt-0.5 text-[12.5px] text-slate-400">We&apos;re preparing your order</p>

      <div className="mt-4 w-full space-y-2.5 rounded-xl bg-slate-950/60 px-3.5 py-3 text-left">
        <div className="flex items-start gap-2.5">
          <svg className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
          <p className="text-[13px] leading-relaxed text-slate-200">
            ဆိုင်ဖွင့်ချိန်အလိုက် <b className="text-emerald-300">15 မိနစ် – 8 နာရီ</b> အတွင်း ပို့ပေးပါမယ်
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <svg className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
          <p className="text-[13px] leading-relaxed text-slate-300">
            ပို့ပြီးတာနဲ့ email နဲ့ အကြောင်းကြားပြီး login အချက်အလက်တွေ ဒီမှာ ပေါ်လာပါမယ်
          </p>
        </div>
      </div>

      {age != null && <p className="mt-3 text-xs text-slate-500">Order တင်ထားတာ {elapsedLabel(age)} ရှိပါပြီ</p>}
    </div>
  );
}
