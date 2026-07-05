// app/topup/KbzTopupForm.tsx
'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui';
import { Copy } from 'lucide-react';

type BankRow = { id: string; bank_name: string; account_name: string; account_no: string; qr_code_url: string | null; instructions: string | null };

type VerifyPhase = 'idle' | 'submitting' | 'scanning_qr' | 'reading_slip' | 'verifying' | 'result';
type ResultData = {
  status: 'approved' | 'rejected' | 'qr_not_found' | 'manual_review';
  reason_mm: string;
  reason_en: string;
};

function copy(text: string) { navigator.clipboard?.writeText(text).catch(() => {}); }

const PRESETS = ['5000', '10000', '15000'];

// ── Floating Verification Overlay ──
function VerifyOverlay({ phase, result, onClose, onRetry }: {
  phase: VerifyPhase;
  result: ResultData | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  if (phase === 'idle') return null;

  const isProcessing = phase !== 'result';
  const isApproved = result?.status === 'approved';
  const isRejected = result?.status === 'rejected';
  const isQrMissing = result?.status === 'qr_not_found';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">

        {isProcessing && (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-6 relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-[3px] border-slate-800" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-emerald-400" style={{ animation: 'kbz-spin 1s linear infinite' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                {phase === 'submitting' && <span className="text-xl">📤</span>}
                {phase === 'scanning_qr' && <span className="text-xl">🔍</span>}
                {phase === 'reading_slip' && <span className="text-xl">🤖</span>}
                {phase === 'verifying' && <span className="text-xl">✅</span>}
              </div>
            </div>
            <p className="text-base font-semibold text-slate-100">
              {phase === 'submitting' && 'တင်သွင်းနေပါသည်...'}
              {phase === 'scanning_qr' && 'QR Code စစ်ဆေးနေပါသည်...'}
              {phase === 'reading_slip' && 'Payment Slip ဖတ်ရှုနေပါသည်...'}
              {phase === 'verifying' && 'အချက်အလက်များ တိုက်စစ်နေပါသည်...'}
            </p>
            <p className="mt-2 text-xs text-slate-500">Please do not close or reload the page</p>
            <div className="mt-4 flex justify-center gap-1.5">
              {['submitting', 'scanning_qr', 'reading_slip', 'verifying'].map((step, i) => {
                const current = ['submitting', 'scanning_qr', 'reading_slip', 'verifying'].indexOf(phase);
                return <div key={step} className={`h-1.5 rounded-full transition-all duration-300 ${i <= current ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-800'}`} />;
              })}
            </div>
          </div>
        )}

        {phase === 'result' && result && (
          <div className="px-6 py-8 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isApproved ? 'bg-emerald-500/15' : isRejected ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
              {isApproved && (
                <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" style={{ animation: 'kbz-draw 0.5s ease-out forwards' }} />
                </svg>
              )}
              {isRejected && (
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {(isQrMissing || result.status === 'manual_review') && (
                <span className="text-3xl">{isQrMissing ? '📷' : '⏳'}</span>
              )}
            </div>
            <p className={`text-lg font-bold ${isApproved ? 'text-emerald-300' : isRejected ? 'text-red-300' : 'text-amber-300'}`}>
              {isApproved && 'ငွေဖြည့်သွင်းမှု အောင်မြင်ပါသည်'}
              {isRejected && 'ငွေဖြည့်သွင်းမှု မအောင်မြင်ပါ'}
              {isQrMissing && 'QR Code မတွေ့ရှိပါ'}
              {result.status === 'manual_review' && 'စစ်ဆေးဆဲ ဖြစ်ပါသည်'}
            </p>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">{result.reason_mm}</p>
            <p className="mt-1 text-[11px] text-slate-500">{result.reason_en}</p>
            <div className="mt-6 space-y-2">
              {isQrMissing ? (
                <button onClick={onRetry} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400">
                  Screenshot ပြန်လည် Upload လုပ်ပါ
                </button>
              ) : (
                <button onClick={onClose} className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${isApproved ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
                  {isApproved ? 'အိုကေ' : 'ပိတ်မည်'}
                </button>
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes kbz-spin { to { transform: rotate(360deg); } }
          @keyframes kbz-draw {
            from { stroke-dasharray: 100; stroke-dashoffset: 100; }
            to { stroke-dasharray: 100; stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Main Form ──
export default function KbzTopupForm({ bank }: { bank: BankRow }) {
  const [amount, setAmount] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<VerifyPhase>('idle');
  const [result, setResult] = useState<ResultData | null>(null);
  const [showQr, setShowQr] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validAmount = Number(amount) > 0;
  const hasSlip = !!slipFile;
  const canSubmit = validAmount && hasSlip && phase === 'idle';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return;
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
    setResult(null);
  }

  function removeSlip() {
    setSlipFile(null); setSlipPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(new Error('Read failed'));
      reader.readAsDataURL(file);
    });
  }

  function handleClose() { setPhase('idle'); setResult(null); setAmount(''); removeSlip(); }
  function handleRetry() { setPhase('idle'); setResult(null); removeSlip(); }

  async function handleSubmit() {
    if (!canSubmit) return;
    setResult(null);
    try {
      setPhase('submitting');
      const res = await fetch('/api/topups', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount), last4: '0000', bankAccountId: bank.id, bankName: bank.bank_name, accountNo: bank.account_no, method: 'qr' }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) { setResult({ status: 'rejected', reason_mm: json?.error ?? 'တင်သွင်းမှု မအောင်မြင်ပါ', reason_en: json?.error ?? 'Failed.' }); setPhase('result'); return; }
      const topupId = json?.topupId;
      if (!topupId) { setResult({ status: 'manual_review', reason_mm: 'တင်သွင်းပြီးပါပြီ။ စစ်ဆေးပေးပါမည်', reason_en: 'Submitted for review.' }); setPhase('result'); return; }

      setPhase('scanning_qr');
      const base64 = await fileToBase64(slipFile!);
      await new Promise(r => setTimeout(r, 500));
      setPhase('reading_slip');
      await new Promise(r => setTimeout(r, 300));
      setPhase('verifying');

      const verifyRes = await fetch('/api/topups/verify-slip', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topupId, imageBase64: base64, mediaType: slipFile!.type }),
      });
      const verifyJson = await verifyRes.json().catch(() => ({} as any));

      setResult({
        status: verifyJson.status ?? 'manual_review',
        reason_mm: verifyJson.reason_mm ?? 'စစ်ဆေးဆဲ ဖြစ်ပါသည်',
        reason_en: verifyJson.reason_en ?? 'Under review.',
      });
      setPhase('result');
    } catch (err: any) {
      setResult({ status: 'rejected', reason_mm: 'အမှားတစ်ခု ဖြစ်ပေါ်ပါသည်', reason_en: err?.message ?? 'Something went wrong.' });
      setPhase('result');
    }
  }

  return (
    <>
      <VerifyOverlay phase={phase} result={result} onClose={handleClose} onRetry={handleRetry} />

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* LEFT: Account details */}
        <aside className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-300">
            💳 KBZ Pay
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">Auto-approval</span>
          </h2>
          <p className="text-xs text-slate-400">Transfer to this account, then upload the screenshot below.</p>

          {/* Account details */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2.5 text-sm">
              <span className="text-xs text-slate-500">Account name</span>
              <span className="text-slate-200">{bank.account_name}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2.5 text-sm">
              <span className="text-xs text-slate-500">Account number</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-slate-50">{bank.account_no}</span>
                <button type="button" onClick={() => copy(bank.account_no)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-300 hover:border-emerald-500 hover:text-emerald-300">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible QR code */}
          {bank.qr_code_url && (
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50">
              <button
                type="button"
                onClick={() => setShowQr(!showQr)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-xs text-slate-400 hover:text-emerald-300 transition"
              >
                <span>📱 QR Code ဖြင့် ငွေလွှဲမည်</span>
                <span className={`transition-transform ${showQr ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {showQr && (
                <div className="px-3 pb-3">
                  <img src={bank.qr_code_url} alt="KBZ QR" className="mx-auto h-auto max-h-[240px] rounded-lg border border-slate-800 bg-white object-contain" />
                </div>
              )}
            </div>
          )}
        </aside>

        {/* RIGHT: Upload form */}
        <section className="space-y-4 self-start lg:sticky lg:top-6">
          {/* Amount */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              လိုသလို ထည့်သွင်းလိုသော ငွေပမာဏ (Custom amount)
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setAmount(p)}
                  className={`rounded-full px-3 py-1.5 text-sm transition ${amount === p ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'border border-slate-800 bg-slate-900 text-slate-200 hover:border-emerald-500'}`}>
                  {Number(p).toLocaleString()} MMK
                </button>
              ))}
            </div>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric" placeholder="ငွေပမာဏ ထည့်ပါ"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/60" />
          </div>

          {/* Screenshot */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Payment Screenshot <span className="text-red-400">*</span>
            </p>
            <p className="mb-2 text-[10px] text-amber-300/80">⚠ QR Code ပါဝင်သော Screenshot အပြည့်အစုံ Upload လုပ်ပါ</p>
            {slipPreview ? (
              <div className="relative inline-block">
                <img src={slipPreview} alt="Slip" className="h-48 rounded-lg border border-slate-700 object-contain" />
                <button type="button" onClick={removeSlip} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600">✕</button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-4 py-8 text-sm text-slate-400 transition hover:border-emerald-500/50 hover:text-slate-300">
                <svg className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span>Upload KBZ Pay screenshot</span>
                <span className="text-[10px] text-slate-500">JPG or PNG, max 10MB</span>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            )}
          </div>

          {/* Submit */}
          <div>
            <Button disabled={!canSubmit} onClick={handleSubmit} className="w-full">
              Submit & Auto-Verify
            </Button>
            {!validAmount && <p className="mt-2 text-[11px] text-amber-300">ငွေပမာဏ ထည့်ပါ</p>}
            {validAmount && !hasSlip && <p className="mt-2 text-[11px] text-amber-300">Payment screenshot Upload လုပ်ပါ</p>}
          </div>
        </section>
      </div>
    </>
  );
}
