'use client';

import { useState } from 'react';
import { Button } from './ui';

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm">
      <span className="truncate text-slate-200">
        <span className="text-slate-500">{label}:</span> {value}
      </span>
      <Button variant="secondary" onClick={handleCopy} className="px-2 py-1 text-xs">
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
