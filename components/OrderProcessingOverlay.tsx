'use client';

import { useEffect, useState } from 'react';
import CityBot from '@/components/CityBot';

/**
 * Full-screen "your order is on its way" screen shown while a purchase runs.
 * Some products take a while to deliver, so the message changes the longer
 * it takes. It stays generic on purpose (no internal steps).
 */
const STEPS: { after: number; mm: string; en: string }[] = [
  { after: 0, mm: 'Order တင်နေပါတယ်', en: 'Placing your order' },
  { after: 3, mm: 'သင့်အတွက် ပြင်ဆင်နေပါတယ်', en: 'Getting it ready for you' },
  { after: 9, mm: 'နည်းနည်းကြာနိုင်ပါတယ်၊ ခဏစောင့်ပေးပါ', en: 'This one takes a little longer' },
  { after: 20, mm: 'ပြီးခါနီးပါပြီ', en: 'Almost there' },
];

export default function OrderProcessingOverlay({ productName }: { productName?: string }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(t);
  }, []);

  const step = [...STEPS].reverse().find((s) => secs >= s.after) ?? STEPS[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(120%_80%_at_50%_0%,#13233f_0%,#0f172a_55%,#0b1324_100%)] px-5 pb-6 pt-4 text-center shadow-2xl"
      >
        <CityBot pose="cart" size={190} className="mx-auto" label="City Bot is placing your order" />
        {productName && <p className="mt-1 truncate text-[13px] text-slate-400">{productName}</p>}
        <p key={step.mm} className="mt-1 text-[17px] font-semibold text-slate-50">
          {step.mm}
          <span className="cb-dot">.</span>
          <span className="cb-dot" style={{ animationDelay: '.2s' }}>.</span>
          <span className="cb-dot" style={{ animationDelay: '.4s' }}>.</span>
        </p>
        <p className="mt-0.5 text-[12px] text-slate-500">{step.en}</p>

        <div className="mx-auto mt-4 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-800">
          <div className="cb-bar h-full w-2/5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300" />
        </div>

        <p className="mt-4 text-[12.5px] text-slate-400">ဒီ page ကို မပိတ်ပါနဲ့၊ ထပ်မနှိပ်ပါနဲ့</p>
      </div>
    </div>
  );
}
