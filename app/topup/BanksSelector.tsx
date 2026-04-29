'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { Copy, CheckCircle2, X, AlertTriangle } from 'lucide-react';

type BankRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no: string;
  qr_code_url: string | null;
  instructions: string | null;
};

type Props = {
  banks: BankRow[];
};

type ModalState =
  | { show: false }
  | {
      show: true;
      status: 'success' | 'error';
      title: string;
      message: string;
    };

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

/* ----------------------------- Simple Modal UI ----------------------------- */
function Modal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  if (!state.show) return null;
  const isSuccess = state.status === 'success';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          {isSuccess ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          )}
          <h3 className="text-lg font-semibold">{state.title}</h3>
        </div>
        <p className="mb-6 text-sm text-slate-300">{state.message}</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Close
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Main Selector ------------------------------ */
export default function BanksSelector({ banks }: Props) {
  const [selectedId, setSelectedId] = useState<string>(banks[0]?.id ?? '');
  const selected = useMemo(
    () => banks.find((b) => b.id === selectedId) ?? null,
    [banks, selectedId]
  );

  // 🔁 Default to BANK ACCOUNT instead of QR
  const [method, setMethod] = useState<'qr' | 'account'>('account');
  const [amount, setAmount] = useState<string>('');
  const [last4, setLast4] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>({ show: false });

  const presets = ['5000', '10000', '15000'];
  const handlePreset = (v: string) => setAmount(v);

  async function handleSubmit() {
    if (!selected) {
      setModal({
        show: true,
        status: 'error',
        title: 'Choose a payment method',
        message: 'Pick a bank first, then choose QR or Account.',
      });
      return;
    }

    const amt = Number(amount);
    const validAmt = Number.isFinite(amt) && amt > 0;
    const validLast4 = /^\d{4}$/.test(last4);

    if (!validAmt || !validLast4) {
      setModal({
        show: true,
        status: 'error',
        title: 'Incomplete details',
        message:
          'Enter a valid amount and your transaction last 4 digits (exactly 4 numbers).',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/topups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          last4,
          bankAccountId: selected.id,
          bankName: selected.bank_name,
          accountNo: selected.account_no,
          method,
        }),
      });

      let payload: any = null;
      try {
        payload = await res.json();
      } catch {
        payload = null;
      }

      // ✅ Only treat as error if HTTP not ok OR explicit success:false
      if (!res.ok || (payload && payload.success === false)) {
        throw new Error(payload?.error || 'Failed to submit top-up.');
      }

      setModal({
        show: true,
        status: 'success',
        title: 'Top-up submitted',
        message:
          'We received your submission. Our team will verify the payment and top up your wallet shortly.',
      });

      setAmount('');
      setLast4('');
    } catch (err: any) {
      console.error('Topup submit failed:', err);
      setModal({
        show: true,
        status: 'error',
        title: 'Submission failed',
        message: err?.message ?? 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* LEFT: selector */}
        <aside className="space-y-3">
          <h2 className="text-lg font-semibold text-emerald-300">Payment method</h2>
          <p className="text-xs text-slate-500">
            Choose a bank you transferred to. You’ll see QR or account details on the right.
          </p>
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40">
            <ul className="divide-y divide-slate-800">
              {banks.map((b) => {
                const checked = selected?.id === b.id;
                return (
                  <li key={b.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 p-3 text-sm transition-all ${
                        checked
                          ? 'bg-slate-900/90 ring-1 ring-emerald-500/60'
                          : 'hover:bg-slate-900/60'
                      }`}
                    >
                      <input
                        type="radio"
                        name="bank"
                        value={b.id}
                        checked={checked}
                        onChange={() => setSelectedId(b.id)}
                        className="mt-0.5 accent-emerald-500"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {b.bank_name}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* RIGHT: details + form */}
        <section className="space-y-6 self-start lg:sticky lg:top-6">
          {selected ? (
            <>
              {/* Segmented control – Bank Account FIRST, QR SECOND */}
              <div className="inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMethod('account')}
                  className={`rounded-full px-4 py-1.5 transition ${
                    method === 'account'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-emerald-300'
                  }`}
                >
                  Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('qr')}
                  className={`rounded-full px-4 py-1.5 transition ${
                    method === 'qr'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-emerald-300'
                  }`}
                >
                Pay With QR
                </button>
              </div>

              {/* Method details */}
              {method === 'qr' ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm">
                  <p className="mb-3 text-sm text-slate-400">
                    Scan this QR to transfer. Make sure the amount matches exactly with the
                    amount you enter below.
                  </p>
                  {selected.qr_code_url ? (
                    <div className="flex justify-center">
                      <img
                        src={selected.qr_code_url}
                        alt="Payment QR"
                        className="h-auto max-h-[360px] w-full max-w-xs rounded-xl border border-slate-800 bg-slate-950 object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No QR provided for this bank. Please use the bank account method instead.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm">
                  <p className="text-sm text-slate-400">
                    Transfer to the account below:
                  </p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Bank</span>
                      <span className="text-slate-200">{selected.bank_name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Account name</span>
                      <span className="text-slate-200">{selected.account_name}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Account number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-50">
                          {selected.account_no}
                        </span>
                        <button
                          type="button"
                          onClick={() => copy(selected.account_no)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                  {selected.instructions && (
                    <p className="mt-3 text-xs text-slate-400">
                      {selected.instructions}
                    </p>
                  )}
                </div>
              )}

              {/* Amount presets + custom */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePreset(p)}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        amount === p
                          ? 'bg-emerald-500 text-slate-950 shadow-sm'
                          : 'border border-slate-800 bg-slate-900 text-slate-200 hover:border-emerald-500'
                      }`}
                    >
                      {Number(p).toLocaleString('en-US')} MMK
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <p className="mb-1 text-xs text-slate-400">
                    လိုသလို ထည့်သွင်းလိုသော ငွေပမာဏ (Custom amount)
                  </p>
                  <input
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/[^\d]/g, ''))
                    }
                    inputMode="numeric"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                  />
                </div>
              </div>

              {/* Last 4 digits */}
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 shadow-sm">
                <p className="mb-2 text-sm text-slate-400">
                  ငွေလွဲပြေစာမှ Transaction ID နောက်ဆုံးနံပါတ် 4 လုံးထည့်ပါ
                  (Last 4 digits of your transaction ID)
                </p>
                <input
                  value={last4}
                  onChange={(e) =>
                    setLast4(e.target.value.replace(/[^\d]/g, '').slice(0, 4))
                  }
                  inputMode="numeric"
                  placeholder="1234"
                  className="w-36 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-center text-sm tracking-[0.4em] text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  This helps us match your payment with your wallet.
                </p>
              </div>

              <div className="flex justify-end">
                <Button disabled={submitting} onClick={handleSubmit}>
                  {submitting ? 'Submitting…' : 'Submit top-up'}
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
              Select a payment method on the left to see QR or bank account details here.
            </div>
          )}
        </section>
      </div>

      <Modal state={modal} onClose={() => setModal({ show: false })} />
    </>
  );
}
