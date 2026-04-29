import { clsx } from 'clsx';
import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const { className, variant = 'primary', ...rest } = props;
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
        variant === 'secondary' && 'border border-slate-700 bg-slate-800 text-slate-100 hover:border-emerald-400',
        variant === 'ghost' && 'text-emerald-300 hover:text-emerald-200',
        className
      )}
      {...rest}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      className={clsx(
        'w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none',
        className
      )}
      {...rest}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={clsx(
        'w-full rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none',
        className
      )}
      {...rest}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="rounded border border-slate-800 bg-slate-900/70 p-6">{children}</div>;
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-sm text-emerald-400 hover:text-emerald-300">
      {children}
    </Link>
  );
}
