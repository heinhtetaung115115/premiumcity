'use client';

import { useFormStatus } from 'react-dom';

type Variant = 'approve' | 'reject' | 'deliver' | 'neutral' | 'primary';

const styles: Record<Variant, string> = {
  approve: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
  primary: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
  deliver: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
  reject:
    'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-500/50 hover:bg-rose-500/20',
  neutral:
    'border border-slate-700 text-slate-400 hover:border-rose-400 hover:text-rose-300',
};

export function SubmitButton({
  children,
  variant = 'primary',
  className = '',
  fullWidth = false,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  fullWidth?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
        fullWidth ? 'w-full' : ''
      } ${styles[variant]} ${className}`}
    >
      {pending && (
        <svg
          className="h-3.5 w-3.5 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      )}
      <span>{pending ? 'Please wait…' : children}</span>
    </button>
  );
}
