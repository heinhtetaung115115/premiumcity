'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Input } from '@/components/ui';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const params = useSearchParams();
  const router = useRouter();

  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasToken = Boolean(token);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!hasToken) {
      setError('Invalid or missing reset token.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Failed to reset password. Please try again.');
      } else {
        setMessage('Your password has been updated. You can now log in.');
        // optional: redirect after a small delay
        setTimeout(() => router.push('/login'), 2500);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!hasToken) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold text-slate-100">
          Invalid reset link
        </h1>
        <p className="text-sm text-slate-400">
          The password reset link is missing or invalid. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-emerald-400 hover:text-emerald-300"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-slate-400">
          {email
            ? `Resetting password for ${email}`
            : 'Enter a new password for your account.'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            className="text-xs uppercase text-slate-400"
            htmlFor="password"
          >
            New password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label
            className="text-xs uppercase text-slate-400"
            htmlFor="confirm"
          >
            Confirm password
          </label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            placeholder="Repeat new password"
            value={confirm}
            required
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        {message && <p className="text-sm text-emerald-400">{message}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
