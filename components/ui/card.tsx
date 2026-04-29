import * as React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={
        // base card styling
        'rounded-2xl border border-slate-800 bg-slate-900 ' +
        className
      }
      {...props}
    />
  )
);

Card.displayName = 'Card';
