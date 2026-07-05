// app/topup/ManualTopupForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui';
import { Copy, CheckCircle2, X, AlertTriangle } from 'lucide-react';

type BankRow = { id: string; bank_name: string; account_name: string; account_no: string; qr_code_url: string | null; instructions: string | null };
type Props = { banks: BankRow[] };
type ModalState = { show: false } | { show: true; status: 'success' | 'error'; title: string; message: string };

function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

function Modal({ state, onClose }: { state: ModalState; onClose: () => void }) {
  if (!state.show) return null;
  const isOk = state.status === 'success';
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          {isOk ? <CheckCircle2 className="h-6 w-6 text-emerald-400" /> : <AlertTriangle className="h-6 w-6 text-amber-400" />}
          <h3 className="text-lg font-semibold">{state.title}</h3>
        </div>
        <p className="mb-6 text-sm text-slate-300">{state.message}</p>
        <div className="flex justify-end"><Button onClick={onClose}><span className="inline-flex items-center gap-2"><X className="h-4 w-4" />Close</span></Button></div>
      </div>
    </div>
  );
}

export default function ManualTopupForm({ banks }: Props) {
  const [selectedId, setSelectedId] = useState<string>(banks[0]?.id ?? '');
  const selected = useMemo(() => banks.find((b) => b.id === selectedId) ?? null, [banks, selectedId]);
  const [method, setMethod] = useState<'qr' | 'account'>('account');
  const [amount, setAmount] = useState('');
  const [last4, setLast4] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modal, setModal] = useState<ModalState>({ show: false });
  const presets = ['5000', '10000', '15000'];

  async function handleSubmit() {
    if (!selected) { setModal({ show: true, status: 'error', title: 'Choose a payment method', message: 'Pick a bank first.' }); return; }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0 || !/^\d{4}$/.test(last4)) {
      setModal({ show: true, status: 'error', title: 'Incomplete details', message: 'Enter a valid amount and 4-digit transaction ID.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/topups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, last4, bankAccountId: selected.id, bankName: selected.bank_name, accountNo: selected.account_no, method }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || 'Failed');
      setModal({ show: true, status: 'success', title: 'Top-up submitted', message: 'Our team will verify and credit your wallet shortly.' });
      setAmount(''); setLast4('');
    } catch (err: any) {
      setModal({ show: true, status: 'error', title: 'Failed', message: err?.message ?? 'Something went wrong.' });
    } finally { setSubmitting(false); }
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-200">🏦 Select bank</h2>
          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-900/50">
            <ul className="divide-y divide-slate-800">
              {banks.map((b) => (
                <li key={b.id}>
                  <label className={`flex cursor-pointer items-center gap-3 p-3 text-sm transition-all ${selected?.id === b.id ? 'bg-slate-900/90 ring-1 ring-emerald-500/60' : 'hover:bg-slate-900/60'}`}>
                    <input type="radio" name="bank" value={b.id} checked={selected?.id === b.id} onChange={() => setSelectedId(b.id)} className="mt-0.5 accent-emerald-500" />
                    <p className="truncate text-sm font-medium text-slate-100">{b.bank_name}</p>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="space-y-6 self-start lg:sticky lg:top-6">
          {selected ? (
            <>
              <div className="inline-flex rounded-full bg-slate-900/80 p-1 text-xs">
                <button type="button" onClick={() => setMethod('account')} className={`rounded-full px-4 py-1.5 transition ${method === 'account' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-emerald-300'}`}>Bank Account</button>
                <button type="button" onClick={() => setMethod('qr')} className={`rounded-full px-4 py-1.5 transition ${method === 'qr' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-emerald-300'}`}>Pay With QR</button>
              </div>

              {method === 'qr' ? (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                  <p className="mb-3 text-sm text-slate-400">Scan this QR to transfer.</p>
                  {selected.qr_code_url ? (
                    <div className="flex justify-center"><img src={selected.qr_code_url} alt="QR" className="h-auto max-h-[360px] w-full max-w-xs rounded-xl border border-slate-800 bg-slate-950 object-contain" /></div>
                  ) : <p className="text-sm text-slate-500">No QR for this bank.</p>}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                  <p className="text-sm text-slate-400">Transfer to:</p>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"><span className="text-xs text-slate-500">Bank</span><span className="text-slate-200">{selected.bank_name}</span></div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2"><span className="text-xs text-slate-500">Account name</span><span className="text-slate-200">{selected.account_name}</span></div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-500">Account number</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-50">{selected.account_no}</span>
                        <button type="button" onClick={() => copy(selected.account_no)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-500 hover:text-emerald-300"><Copy className="h-3.5 w-3.5" />Copy</button>
                      </div>
                    </div>
                  </div>
                  {selected.instructions && <p className="mt-3 text-xs text-slate-400">{selected.instructions}</p>}
                </div>
              )}

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  လိုသလို ထည့်သွင်းလိုသော ငွေပမာဏ (Custom amount)
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button key={p} type="button" onClick={() => setAmount(p)} className={`rounded-full px-3 py-1.5 text-sm transition ${amount === p ? 'bg-emerald-500 text-slate-950' : 'border border-slate-800 bg-slate-900 text-slate-200 hover:border-emerald-500'}`}>{Number(p).toLocaleString()} MMK</button>
                  ))}
                </div>
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="ငွေပမာဏ ထည့်ပါ" className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500" />
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
                <p className="mb-2 text-sm text-slate-400">ငွေလွဲပြေစာမှ Transaction ID နောက်ဆုံးနံပါတ် 4 လုံးထည့်ပါ</p>
                <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/[^\d]/g, '').slice(0, 4))} inputMode="numeric" placeholder="1234" className="w-36 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-center text-sm tracking-[0.4em] text-slate-50 outline-none focus:border-emerald-500" />
              </div>

              <div className="flex justify-end"><Button disabled={submitting} onClick={handleSubmit}>{submitting ? 'Submitting…' : 'Submit top-up'}</Button></div>
            </>
          ) : (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 text-sm text-slate-400">Select a bank on the left.</div>
          )}
        </section>
      </div>
      <Modal state={modal} onClose={() => setModal({ show: false })} />
    </>
  );
}
