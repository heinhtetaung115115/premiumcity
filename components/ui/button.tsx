import * as React from 'react';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ' +
      'disabled:opacity-50 disabled:cursor-not-allowed ';

    const variantClass =
      variant === 'secondary'
        ? 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400 hover:text-emerald-300 '
        : variant === 'ghost'
        ? 'bg-transparent text-slate-200 hover:bg-slate-900 '
        : // primary (default)
          'bg-emerald-500 text-slate-950 hover:bg-emerald-400 ';

    return (
      <button
        ref={ref}
        className={base + variantClass + className}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
