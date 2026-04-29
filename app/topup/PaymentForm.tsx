// app/topup/PaymentForm.tsx
'use client';

import { useState } from 'react';
import { Button, Input } from '@/components/ui';

const PRESETS = [5000, 10000, 15000];

export default function PaymentForm({ bankAccountId }: { bankAccountId: string }) {
  const [amount, setAmount] = useState<string>('');
  const [last4, setLast4] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const validAmount = Number(amount) > 0;
  const validLast4 = /^\d{4}$/.test(last4);
  const canSubmit = validAmount && validLast4 && !!bankAccountId && !submitting;

  function setPreset(v: number) {
    setAmount(String(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (!canSubmit) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          last4,
          bankAccountId
        })
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setMessage({ type: 'err', text: json?.error ?? 'Failed to submit top-up' });
        return;
      }
      setMessage({ type: 'ok', text: 'Top-up submitted. We emailed you a confirmation.' });
      setAmount('');
      setLast4('');
    } catch (err: any) {
      setMessage({ type: 'err', text: err?.message ?? 'Unexpected error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((v) => (
          <Button key={v} type="button" variant="secondary" onClick={() => setPreset(v)}>
            {v.toLocaleString()}
          </Button>
        ))}
      </div>

      {/* Custom amount (no spinners) */}
      <div>
        <label className="text-xs uppercase text-slate-400">Custom amount</label>
        <Input
          name="amount"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter amount (e.g. 5000)"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/\D+/g, ''))}
        />
      </div>

      {/* Last 4 digits */}
      <div>
        <label className="text-xs uppercase text-slate-400">Last 4 digits of transaction ID</label>
        <Input
          name="last4"
          type="tel"
          inputMode="numeric"
          pattern="\d{4}"
          placeholder="e.g. 1234"
          maxLength={4}
          value={last4}
          onChange={(e) => setLast4(e.target.value.replace(/\D+/g, '').slice(0, 4))}
        />
      </div>

      <div className="pt-1">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? 'Submitting…' : 'Submit'}
        </Button>
        {!bankAccountId && (
          <div className="mt-2 text-xs text-amber-300">Select a payment method first.</div>
        )}
        {(!validAmount || !validLast4) && (
          <div className="mt-2 text-xs text-amber-300">
            {!validAmount && 'Enter a valid amount. '}
            {!validLast4 && 'Enter exactly 4 digits.'}
          </div>
        )}
        {message && (
          <div
            className={`mt-2 text-xs ${
              message.type === 'ok' ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {message.text}
          </div>
        )}
      </div>
    </form>
  );
}
