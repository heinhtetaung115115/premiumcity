'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { startRegistration, verifyRegistration, resendCode } from './actions';

type Step = 'form' | 'code' | 'done';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // code entry
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (step === 'done') {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.4 } }), 400);
    }
  }, [step]);

  // ── Step 1: submit registration form ──
  async function handleFormSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!accepted) {
      setError('Please accept the Terms & Conditions.');
      return;
    }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await startRegistration(null, fd);
    setLoading(false);

    if (res.success && res.step === 'code') {
      setEmail(res.email || (fd.get('email') as string));
      setStep('code');
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    } else {
      setError(res.error || 'Something went wrong.');
    }
  }

  // ── Step 2: code entry ──
  function handleDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) codeRefs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text.length) {
      const arr = text.split('');
      const next = ['', '', '', '', '', ''];
      arr.forEach((d, idx) => (next[idx] = d));
      setDigits(next);
      codeRefs.current[Math.min(arr.length, 5)]?.focus();
      e.preventDefault();
    }
  }

  async function handleVerify() {
    setError('');
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Enter all 6 digits.');
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.set('email', email);
    fd.set('code', code);
    const res = await verifyRegistration(null, fd);
    setLoading(false);

    if (res.success && res.step === 'done') {
      setStep('done');
    } else {
      setError(res.error || 'Verification failed.');
      if (res.step === 'form') setStep('form');
      setDigits(['', '', '', '', '', '']);
    }
  }

  async function handleResend() {
    setResendMsg('');
    setError('');
    setResending(true);
    const fd = new FormData();
    fd.set('email', email);
    const res = await resendCode(null, fd);
    setResending(false);
    if (res.success) {
      setResendMsg('A new code has been sent to your email.');
      setDigits(['', '', '', '', '', '']);
      codeRefs.current[0]?.focus();
    } else {
      setError(res.error || 'Could not resend code.');
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
            <p className="text-[13px] text-emerald-50">
              {step === 'code' ? 'Verify your email' : 'Create your account'}
            </p>
          </div>
        </div>

        <div className="px-6 py-6">
          {/* Sign in / Register tabs */}
          {step === 'form' && (
            <div className="mb-5 flex gap-2 rounded-xl bg-white/[0.04] p-1">
              <Link
                href="/login"
                className="flex-1 rounded-lg py-2 text-center text-[13px] text-slate-400 hover:text-slate-200"
              >
                Sign in
              </Link>
              <span className="flex-1 rounded-lg bg-emerald-500 py-2 text-center text-[13px] font-semibold text-slate-950">
                Register
              </span>
            </div>
          )}

          {/* ── STEP 1: FORM ── */}
          {step === 'form' && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">Name</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-white/[0.04] px-3.5 py-2.5 focus-within:border-emerald-500">
                  <svg className="h-[18px] w-[18px] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <input name="name" required minLength={2} placeholder="Jane Doe" className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">Email</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-white/[0.04] px-3.5 py-2.5 focus-within:border-emerald-500">
                  <svg className="h-[18px] w-[18px] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16v16H4z" opacity="0" /><path d="M22 6l-10 7L2 6M2 6h20v12H2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <input name="email" type="email" required placeholder="you@example.com" className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-wide text-slate-500">Password</label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-white/[0.04] px-3.5 py-2.5 focus-within:border-emerald-500">
                  <svg className="h-[18px] w-[18px] text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 118 0v4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <input name="password" type={showPw ? 'text' : 'password'} required minLength={8} placeholder="Min 8 chars, a letter & a number" className="w-full bg-transparent text-sm text-slate-50 outline-none placeholder:text-slate-600" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="text-slate-500 hover:text-slate-300" tabIndex={-1}>
                    {showPw ? (
                      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17.94 17.94A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015.06-5.94M9.9 4.24A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.16 3.19M1 1l22 22" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : (
                      <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 accent-emerald-500" />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" target="_blank" className="text-emerald-400 underline hover:text-emerald-300">Terms &amp; Conditions</Link>
                </span>
              </label>

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <button
                type="submit"
                disabled={loading || !accepted}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
                    Sending code…
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </form>
          )}

          {/* ── STEP 2: CODE ── */}
          {step === 'code' && (
            <div className="space-y-5">
              <p className="text-center text-[13px] leading-relaxed text-slate-300">
                We sent a 6-digit code to<br />
                <span className="font-medium text-emerald-300">{email}</span>
              </p>

              <div className="flex justify-center gap-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      codeRefs.current[i] = el;
                    }}
                    value={d}
                    onChange={(e) => handleDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    inputMode="numeric"
                    maxLength={1}
                    className="h-12 w-11 rounded-xl border border-slate-700 bg-white/[0.04] text-center text-lg font-semibold text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
                  />
                ))}
              </div>

              {error && <p className="text-center text-sm text-rose-400">{error}</p>}
              {resendMsg && <p className="text-center text-xs text-emerald-400">{resendMsg}</p>}

              <button
                onClick={handleVerify}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/40 border-t-slate-950" />
                    Verifying…
                  </>
                ) : (
                  'Verify & create account'
                )}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button onClick={() => { setStep('form'); setError(''); setDigits(['','','','','','']); }} className="text-slate-500 hover:text-slate-300">
                  ← Change details
                </button>
                <button onClick={handleResend} disabled={resending} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-60">
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: DONE ── */}
          {step === 'done' && (
            <div className="py-4 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-4xl">🎉</div>
              <h2 className="mb-2 text-lg font-bold text-emerald-300">Account created!</h2>
              <p className="mb-6 text-sm text-slate-300">Your email is verified. You can now sign in.</p>
              <button
                onClick={() => router.push('/login')}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-emerald-500"
              >
                Go to Sign in
              </button>
            </div>
          )}

          {step === 'form' && (
            <p className="mt-5 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
