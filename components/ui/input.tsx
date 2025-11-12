import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={
        'w-full rounded-xl border px-3 py-2 outline-none ' +
        'border-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-200 ' +
        className
      }
      {...props}
    />
  )
);
Input.displayName = 'Input';
