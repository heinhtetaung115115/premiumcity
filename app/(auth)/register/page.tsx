'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { registerUser } from './actions';
import { Button, Input } from '@/components/ui';

const initialState = { success: false, error: '' };

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerUser, initialState);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-sm text-slate-400">Sign up to purchase products and manage your wallet.</p>
      </header>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="text-xs uppercase text-slate-400" htmlFor="name">
            Name
          </label>
          <Input id="name" name="name" placeholder="Jane Doe" required minLength={2} />
        </div>
        <div>
          <label className="text-xs uppercase text-slate-400" htmlFor="email">
            Email
          </label>
          <Input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <div>
          <label className="text-xs uppercase text-slate-400" htmlFor="password">
            Password
          </label>
          <Input id="password" name="password" type="password" placeholder="••••••" required minLength={6} />
        </div>
        {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
        {state.success && <p className="text-sm text-emerald-400">Account created! You can now sign in.</p>}
        <Button type="submit" className="w-full">
          Register
        </Button>
      </form>
      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link href="/login" className="text-emerald-400 hover:text-emerald-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
