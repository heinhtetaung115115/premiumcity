'use client';

import { useState } from 'react';

type BankRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no: string;
  qr_code_url: string | null;
  instructions: string | null;
  is_active: boolean;
};

type Props = {
  banks: BankRow[];
};

export default function TopupClient({ banks }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [last4, setLast4] = useState<string>('');
  const [method, setMethod] = useState<'qr' | 'account'>('qr');

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedId) {
      alert('Select a payment method first.');
      return;
    }

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount.');
      return;
    }

    if (!/^\d{4}$/.test(last4)) {
      alert('Please enter the last 4 digits of your transaction ID.');
      return;
    }

    const bank = banks.find((b) => b.id === selectedId);

    const res = await fetch('/api/topups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankAccountId: selectedId,
        bankName: bank?.bank_name,
        accountNo: bank?.account_no,
        method,
        amount,
        last4
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error ?? 'Something went wrong. Please try again.');
      return;
    }

    alert('Thanks! We received your request and will review it ASAP.');

    setAmount(0);
    setLast4('');
    setSelectedId(null);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Banks list */}
      <div className="space-y-2">
        {banks.map((bank) => (
          <label
            key={bank.id}
            className="flex cursor-pointer items-center gap-3 rounded border border-slate-800 bg-slate-900 p-3 hover:border-emerald-400"
          >
            <input
              type="radio"
              name="bank"
              value={bank.id}
              checked={selectedId === bank.id}
              onChange={() => setSelectedId(bank.id)}
            />
            <span>
              {bank.bank_name} · {bank.account_no}
            </span>
          </label>
        ))}
      </div>

      {/* Amount */}
      <input
        type="number"
        min={1000}
        step={100}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        placeholder="Enter amount"
        className="w-full rounded border border-slate-800 bg-slate-900 p-2"
      />

      {/* Last 4 digits */}
      <input
        value={last4}
        onChange={(e) => setLast4(e.target.value)}
        placeholder="Last 4 digits of transaction ID"
        className="w-full rounded border border-slate-800 bg-slate-900 p-2"
        maxLength={4}
      />

      {/* Submit */}
      <button
        type="submit"
        className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
      >
        Submit top-up
      </button>
    </form>
  );
}
