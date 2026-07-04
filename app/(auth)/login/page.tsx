'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function LoginPage() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // 1) Rate limit guard
    try {
      const guardRes = await fetch('/api/auth/login-guard', { method: 'POST' });
      if (!guardRes.ok) {
        const data = await guardRes.json().catch(() => ({}));
        const msg =
          (data && (data as any).error) ||
          'Too many login attempts from your connection. Please try again later.';
        setError(msg);
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error('[login] guard failed:', e);
      setError('Something went wrong. Please try again.');
      setLoading(false);
      return;
    }

    // 2) NextAuth credentials login
    const result = await signIn('credentials', { redirect: false, email, password });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        {/* Brand header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 to-emerald-500 px-6 py-7">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
          <div className="absolute bottom-[-40px] right-8 h-20 w-20 rounded-full bg-white/[0.07]" />
          <div className="relative">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">PremiumCity</h1>
            <p className="text-[13px] text-emerald-50">Sign in to your account</p>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Tabs */}
          <div className="mb-5 flex gap-2 rounded-xl bg-white/[0.04] p-1">
            <span className="flex-1 rounded-lg bg-emerald-500 py-2 text-center text-[13px] font-semibold text-slate-950">
              Sign in
            </span>
            <Link
              href="/register"
              className="flex-1 rounded-lg py-2 text-center text-[13px] text-slate-400 hover:text-slate-200"
            >
              Register
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">Email</label>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-white/[0.04] px-3.5 py-2.5 focus-within:border-emerald-500">
                <svg className="h-[18px] w-[18px] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 6l-10 7L2 6M2 6h20v12H2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <input name="email" type="email" required placeholder="you@example.com" className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600" />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wide text-slate-500">Password</label>
                <Link href="/forgot-password" className="text-[11px] text-emerald-400 hover:text-emerald-300">Forgot password?</Link>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-white/[0.04] px-3.5 py-2.5 focus-within:border-emerald-500">
                <svg className="h-[18px] w-[18px] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 118 0v4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <input name="password" type={showPw ? 'text' : 'password'} required placeholder="••••••••" className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600" />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="text-slate-500 hover:text-slate-300" tabIndex={-1}>
                  {showPw ? (
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : (
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            Need an account?{' '}
            <Link href="/register" className="text-emerald-400 hover:text-emerald-300">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
