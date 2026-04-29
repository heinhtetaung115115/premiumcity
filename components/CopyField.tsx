// components/CopyField.tsx
'use client';

import { useState } from 'react';
import { Button } from './ui';

type CopyFieldProps = {
  label: string;
  value: string | number | null | undefined;
};

export function CopyField({ label, value }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const display = value != null ? String(value) : '';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Clipboard copy failed', err);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
      <span className="truncate text-slate-200">
        <span className="text-slate-500">{label}:</span>{' '}
        {display || <span className="italic text-slate-500">empty</span>}
      </span>
      <Button
        type="button"
        variant="secondary"
        onClick={handleCopy}
        className="px-2 py-1 text-xs"
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
