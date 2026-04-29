'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Button, Input } from '@/components/ui';

export default function LoginPage() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // 1) RATE LIMIT GUARD
    try {
      const guardRes = await fetch('/api/auth/login-guard', {
        method: 'POST',
      });

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

    // 2) ORIGINAL LOGIN LOGIC (NextAuth credentials)
    const result = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    if (result?.error) {
      setError('Invalid email or password');
      setLoading(false);
    } else {
      window.location.href = '/';
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-slate-400">Sign in to continue.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs uppercase text-slate-400" htmlFor="password">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••"
            required
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-slate-400">
        Need an account?{' '}
        <Link href="/register" className="text-emerald-400 hover:text-emerald-300">
          Create one
        </Link>
      </p>
    </div>
  );
}
