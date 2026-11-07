'use client';
import { useState } from 'react';

export function CopyBtn({ value, label = 'Copy', className = '' }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          /* ignore */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className={`rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:border-indigo-400/60 hover:bg-white/5 ${className}`}
    >
      {done ? 'Copied ✓' : label}
    </button>
  );
}
