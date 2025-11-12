'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { registerUser, type ActionResult } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const initialState: ActionResult = { success: false, error: '' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating…' : 'Register'}
    </Button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useFormState(registerUser, initialState);

  return (
    <form action={formAction} className="space-y-4 max-w-sm">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm">Email</label>
        <Input id="email" name="email" type="email" placeholder="you@example.com" required />
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm">Name</label>
        <Input id="name" name="name" type="text" placeholder="Your name" />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm">Password</label>
        <Input id="password" name="password" type="password" placeholder="••••••" required minLength={6} />
      </div>

      {!state.success && state.error && (
        <p className="text-sm text-rose-400">{state.error}</p>
      )}
      {state.success && (
        <p className="text-sm text-emerald-400">Account created! You can now sign in.</p>
      )}

      <SubmitButton />
    </form>
  );
}
