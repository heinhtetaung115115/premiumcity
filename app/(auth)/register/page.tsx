'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';
import { registerUser } from './actions';
import { Button, Input } from '@/components/ui';
import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

const initialState = { success: false, error: '' };

export default function RegisterPage() {
  const router = useRouter();
  const [state, formAction] = useFormState(registerUser, initialState);
  const [accepted, setAccepted] = useState(false);
  const [clientError, setClientError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  const canSubmit = accepted && !loading;

  // 🎉 Trigger confetti exactly once when registration succeeds
  useEffect(() => {
    if (state.success && !hasCelebrated) {
      setHasCelebrated(true);

      // Simple confetti burst
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });

      // Optional second burst for extra fun
      setTimeout(() => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { y: 0.4 },
        });
      }, 400);
    }
  }, [state.success, hasCelebrated]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError('');

    if (!accepted) return;

    setLoading(true);

    const formData = new FormData(event.currentTarget);

    // ✅ NO TURNSTILE, NO GUARD — just register directly
    try {
      await formAction(formData);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* === Loading Overlay === */}
      {loading && !state.success && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-700 bg-slate-900 px-6 py-4 text-center shadow-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            <p className="text-sm text-slate-100">Signing you up…</p>
          </div>
        </div>
      )}

      {/* === Success Modal + CTA to Login === */}
      {state.success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-lg bg-slate-900 p-6 text-center shadow-lg border border-slate-700">
            <h2 className="text-xl font-semibold text-emerald-400 mb-3">
              Account Created 🎉
            </h2>
            <p className="text-sm text-slate-300 mb-6">
              Your account has been created successfully. You may now sign in.
            </p>

            <Button
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Go to Login
            </Button>
          </div>
        </div>
      )}

      {/* === Page Content === */}
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="text-sm text-slate-400">
            Sign up to purchase products and manage your wallet.
          </p>
        </header>

        <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase text-slate-400" htmlFor="name">
              Name
            </label>
            <Input
              id="name"
              name="name"
              placeholder="Jane Doe"
              required
              minLength={2}
            />
          </div>

          <div>
            <label className="text-xs uppercase text-slate-400" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label
              className="text-xs uppercase text-slate-400"
              htmlFor="password"
            >
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••"
              required
              minLength={6}
            />
          </div>

          {/* Terms acceptance */}
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-3 w-3 rounded border-slate-600 bg-slate-800"
            />
            <label htmlFor="terms">
              I agree to the{' '}
              <Link
                href="/terms"
                className="text-emerald-400 underline hover:text-emerald-300"
                target="_blank"
              >
                Terms & Conditions
              </Link>
            </label>
          </div>

          {/* Client-side error (if you ever set one) */}
          {clientError && (
            <p className="text-sm text-rose-400">{clientError}</p>
          )}

          {/* Server-side errors (from registerUser) */}
          {state.error && (
            <p className="text-sm text-rose-400">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {loading ? 'Registering…' : 'Register'}
          </Button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}
