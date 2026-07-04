'use client';

import { useState } from 'react';
import Link from 'next/link';
import { dismissWelcomePopupAction } from '@/app/account/actions';

type Props = {
  show: boolean;
};

export function WelcomeRewardPopup({ show }: Props) {
  const [visible, setVisible] = useState(show);

  if (!visible) return null;

  async function dismiss() {
    setVisible(false);
    try {
      await dismissWelcomePopupAction();
    } catch {
      // non-critical
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-amber-500/40 bg-slate-950 shadow-2xl">
        <div className="bg-gradient-to-br from-amber-500/25 to-emerald-500/15 px-6 pt-7 pb-5 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-4xl">
            🎁
          </div>
          <h2 className="text-lg font-bold text-amber-100">Welcome! Here&apos;s 1,000 KS</h2>
          <p className="mt-1 text-xs text-slate-300">A little gift to get you started</p>
        </div>
        <div className="px-6 py-5">
          <p className="mb-4 text-center text-sm leading-relaxed text-slate-200">
            Profile ပြည့်စုံအောင်လုပ်ခြင်းဖြင့် အခမဲ့ 1000ks ရယူပါ
          </p>
          <div className="space-y-2">
            <Link
              href="/account"
              onClick={dismiss}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
            >
              Complete profile now
            </Link>
            <button
              onClick={dismiss}
              className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
            >
              Maybe later
            </button>
          </div>
          <p className="mt-3 text-center text-[11px] text-slate-600">
            You can claim it anytime from your account page
          </p>
        </div>
      </div>
    </div>
  );
}
