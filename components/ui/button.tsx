import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={
        'inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium ' +
        'bg-black text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed ' +
        className
      }
      {...props}
    />
  )
);
Button.displayName = 'Button';
