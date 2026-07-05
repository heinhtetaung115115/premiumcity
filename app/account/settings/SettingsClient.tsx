'use client';

import { useState } from 'react';
import Link from 'next/link';
import { changePasswordAction } from '../actions';

export function SettingsClient({ email }: { email: string }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const res = await changePasswordAction(fd);
    setSaving(false);
    if (res.success) {
      setMsg({ type: 'ok', text: 'Password changed successfully.' });
      (e.target as HTMLFormElement).reset();
    } else {
      setMsg({ type: 'err', text: res.error || 'Could not change password.' });
    }
  }

  const eye = (show: boolean) =>
    show ? (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );

  return (
    <main className="mx-auto max-w-md px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/account" className="text-sm text-emerald-400 hover:text-emerald-300">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold text-slate-50">Account Settings</h1>
      </div>

      {/* Change password */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-100">Change password</h2>
        <p className="mb-4 text-xs text-slate-500">
          Enter your current password and choose a new one.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current password */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">
              Current password
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 focus-within:border-emerald-500">
              <input
                name="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                required
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600"
              />
              <button type="button" onClick={() => setShowCurrent((s) => !s)} className="text-slate-500 hover:text-slate-300" tabIndex={-1}>
                {eye(showCurrent)}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">
              New password
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 focus-within:border-emerald-500">
              <input
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600"
              />
              <button type="button" onClick={() => setShowNew((s) => !s)} className="text-slate-500 hover:text-slate-300" tabIndex={-1}>
                {eye(showNew)}
              </button>
            </div>
          </div>

          {/* Confirm new password */}
          <div>
            <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">
              Confirm new password
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 focus-within:border-emerald-500">
              <input
                name="confirmPassword"
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                placeholder="Re-enter new password"
                className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600"
              />
            </div>
          </div>

          {msg && (
            <p className={`text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {msg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </form>

        <div className="mt-4 border-t border-slate-800 pt-4 text-center">
          <Link href="/forgot-password" className="text-xs text-emerald-400 hover:text-emerald-300">
            Forgot your current password?
          </Link>
        </div>
      </div>
    </main>
  );
}
