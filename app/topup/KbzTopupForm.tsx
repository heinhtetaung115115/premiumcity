// app/topup/KbzTopupForm.tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import CityBot from '@/components/CityBot';

type BankRow = {
  id: string;
  bank_name: string;
  account_name: string;
  account_no: string;
  qr_code_url: string | null;
  instructions: string | null;
};

type ResultStatus = 'approved' | 'manual_review' | 'rejected' | 'qr_not_found' | 'unreadable' | 'need_amount';
type Result = { status: ResultStatus; reason_mm: string; reason_en: string; amount?: number; balance?: number };
type Phase = 'idle' | 'checking' | 'result';

/** Shrink very large photos so the upload stays fast; keeps the QR readable. */
async function toBase64(file: File): Promise<{ data: string; type: string }> {
  const read = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
      r.onerror = () => reject(new Error('Read failed'));
      r.readAsDataURL(blob);
    });
  if (file.size <= 1_500_000) return { data: await read(file), type: file.type || 'image/jpeg' };
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.92));
    if (blob) return { data: await read(blob), type: 'image/jpeg' };
  } catch {
    /* fall through */
  }
  return { data: await read(file), type: file.type || 'image/jpeg' };
}

function Step({ n, done, children }: { n: number; done?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          done ? 'bg-emerald-500 text-emerald-950' : 'bg-emerald-500 text-emerald-950'
        }`}
      >
        {done ? (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          n
        )}
      </span>
      <h2 className="text-[15px] font-semibold text-slate-100">{children}</h2>
    </div>
  );
}

function SlipGuide() {
  return (
    <svg aria-hidden="true" width="74" height="112" viewBox="0 0 74 112" className="flex-shrink-0">
      <rect x="1" y="1" width="72" height="110" rx="8" fill="#f8fafc" />
      <rect x="1" y="1" width="72" height="14" rx="8" fill="#0b5cad" />
      <rect x="18" y="24" width="38" height="6" rx="3" fill="#94a3b8" />
      <rect x="9" y="38" width="22" height="3" rx="1.5" fill="#cbd5e1" /><rect x="40" y="38" width="25" height="3" rx="1.5" fill="#64748b" />
      <rect x="9" y="46" width="22" height="3" rx="1.5" fill="#cbd5e1" /><rect x="36" y="46" width="29" height="3" rx="1.5" fill="#64748b" />
      <rect x="9" y="54" width="22" height="3" rx="1.5" fill="#cbd5e1" /><rect x="44" y="54" width="21" height="3" rx="1.5" fill="#64748b" />
      <rect x="9" y="62" width="22" height="3" rx="1.5" fill="#cbd5e1" /><rect x="42" y="62" width="23" height="3" rx="1.5" fill="#64748b" />
      <rect x="24" y="76" width="26" height="26" rx="3" fill="#0f172a" />
      <rect x="28" y="80" width="7" height="7" fill="#f8fafc" /><rect x="39" y="80" width="7" height="7" fill="#f8fafc" />
      <rect x="28" y="91" width="7" height="7" fill="#f8fafc" /><rect x="40" y="92" width="4" height="4" fill="#f8fafc" />
      <rect x="20" y="72" width="34" height="34" rx="6" fill="none" stroke="#10b981" strokeWidth="2.5" />
    </svg>
  );
}

export default function KbzTopupForm({ bank, onBack }: { bank: BankRow; onBack?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Result | null>(null);
  const [typedAmount, setTypedAmount] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/') || f.size > 15 * 1024 * 1024) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
  }

  function clearSlip() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setTypedAmount('');
    if (fileRef.current) fileRef.current.value = '';
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(bank.account_no);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function submit(fallbackAmount?: number) {
    if (!file) return;
    setPhase('checking');
    setResult(null);
    try {
      const { data, type } = await toBase64(file);
      const res = await fetch('/api/topups/verify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType: type, ...(fallbackAmount ? { fallbackAmount } : {}) }),
      });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok || !json?.status) {
        setResult({
          status: 'rejected',
          reason_mm: json?.error ?? 'တစ်ခုခု မှားသွားပါတယ်။ ပြန်ကြိုးစားပေးပါ',
          reason_en: json?.error ?? 'Something went wrong. Please try again.',
        });
      } else {
        setResult(json as Result);
      }
    } catch {
      setResult({ status: 'rejected', reason_mm: 'Internet ချိတ်ဆက်မှု စစ်ပြီး ပြန်ကြိုးစားပေးပါ', reason_en: 'Network error. Please try again.' });
    }
    setPhase('result');
  }

  function closeResult() {
    const s = result?.status;
    setPhase('idle');
    if (s === 'approved' || s === 'manual_review' || s === 'rejected') {
      clearSlip();
      setResult(null);
    }
  }

  function retryUpload() {
    setPhase('idle');
    setResult(null);
    clearSlip();
    setTimeout(() => fileRef.current?.click(), 50);
  }

  const st = result?.status;

  return (
    <div className="mx-auto max-w-md space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to payment methods"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white"
          >
            <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-[19px] font-semibold text-slate-50">KBZ Pay ဖြင့် ငွေဖြည့်မယ်</h1>
          <p className="mt-0.5 text-[12.5px] text-slate-400">Slip ထဲက ငွေပမာဏကို အလိုအလျောက် ဖတ်ပေးပါမယ်</p>
        </div>
      </div>

      {/* Step 1: pay */}
      {file ? (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-3.5 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-emerald-950">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] text-slate-100">{bank.account_name}</p>
            <p className="text-xs tabular-nums text-slate-400">KBZPay {bank.account_no}</p>
          </div>
        </div>
      ) : (
        <section className="space-y-2.5">
          <Step n={1}>ဒီ account ကို ငွေလွှဲပါ</Step>
          <div className="overflow-hidden rounded-[20px] bg-[#0b5cad] shadow-[0_18px_40px_-22px_rgba(11,92,173,0.9)]">
            <div className="space-y-3 px-[18px] pb-3.5 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-white">KBZPay</span>
                <span className="text-xs text-[#cfe2fb]">Transfer to</span>
              </div>
              <div>
                <p className="text-xs text-[#cfe2fb]">Account name</p>
                <p className="mt-0.5 text-lg font-semibold text-white">{bank.account_name}</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-[#cfe2fb]">Phone number</p>
                  <p className="mt-0.5 truncate text-[24px] font-semibold tracking-wide text-white tabular-nums">{bank.account_no}</p>
                </div>
                <button
                  type="button"
                  onClick={copyNumber}
                  className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-[#0b5cad] transition active:scale-95"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="11" height="11" rx="2" />
                    <path d="M5 15V6a2 2 0 012-2h9" />
                  </svg>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {bank.qr_code_url && (
              <>
                <button
                  type="button"
                  onClick={() => setShowQr((v) => !v)}
                  aria-expanded={showQr}
                  className="flex h-[46px] w-full items-center justify-center gap-2 border-t border-white/20 bg-black/10 text-[13.5px] font-medium text-white"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <path d="M14 14h3v3h-3zM20 14v7M14 20h3" />
                  </svg>
                  {showQr ? 'QR ကို ဖျောက်မယ်' : 'QR နဲ့ ပေးချေမယ်'}
                </button>
                {showQr && (
                  <div className="flex flex-col items-center gap-2 bg-white p-[18px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bank.qr_code_url} alt="KBZPay QR" className="h-auto max-h-[240px] w-auto rounded-lg object-contain" />
                    <p className="text-[12.5px] text-slate-600">KBZPay app → Scan နဲ့ ဖတ်ပါ</p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* Step 2: slip */}
      <section className="space-y-2.5">
        <Step n={2}>Slip ကို အပြည့် Upload တင်ပါ</Step>
        <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />
        {preview ? (
          <div className="flex gap-3.5 rounded-[20px] border border-slate-800 bg-slate-900 p-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your KBZ Pay slip" className="h-[200px] w-[132px] flex-shrink-0 rounded-xl border border-slate-700 object-cover object-top" />
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-0.5">
              <p className="truncate text-sm font-semibold text-slate-50">{file?.name}</p>
              <p className="text-[12.5px] leading-relaxed text-slate-400">ငွေပမာဏကို ဒီ slip ထဲကနေ ဖတ်ပါမယ်</p>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="h-10 rounded-[10px] border border-slate-700 text-[13px] font-medium text-slate-200 hover:border-slate-500"
              >
                ပုံ ပြောင်းမယ်
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-4 rounded-[18px] border-[1.5px] border-dashed border-slate-700 bg-slate-900 p-4 text-left transition hover:border-emerald-500/60"
          >
            <SlipGuide />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className="text-[15px] font-semibold text-slate-50">Slip ပုံ ရွေးမယ်</span>
              <span className="text-[12.5px] leading-relaxed text-slate-400">အောက်ခြေက QR code ပါအောင် ဖြတ်မထားဘဲ တင်ပေးပါ</span>
              <span className="mt-1 inline-flex h-9 w-fit items-center rounded-[10px] bg-emerald-500 px-3.5 text-[13px] font-semibold text-emerald-950">
                Gallery ကနေ ရွေးမယ်
              </span>
            </span>
          </button>
        )}
      </section>

      {!file && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5">
          <svg className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" strokeLinejoin="round" />
          </svg>
          <p className="text-[13px] leading-relaxed text-slate-300">
            50,000 Ks အထိ ချက်ချင်း ဝင်ပါမယ်။ အဲ့ထက်များရင် admin က စစ်ပြီး ထည့်ပေးပါမယ်။
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!file || phase !== 'idle'}
        onClick={() => submit()}
        className="h-14 w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 text-base font-bold text-emerald-950 shadow-[0_12px_28px_-14px_rgba(16,185,129,0.9)] transition active:scale-[0.98] disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
      >
        ငွေဖြည့်မယ်
      </button>

      {/* Checking / result overlay */}
      {phase !== 'idle' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-sm">
          <div
            role="status"
            aria-live="polite"
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(120%_80%_at_50%_0%,#13233f_0%,#0f172a_55%,#0b1324_100%)] shadow-2xl"
          >
            {phase === 'checking' && (
              <div className="flex flex-col items-center gap-2 px-5 pb-7 pt-5 text-center">
                <CityBot pose="scan" size={210} label="City Bot is checking your slip" />
                <p className="text-[17px] font-semibold text-slate-50">
                  Slip ကို စစ်နေပါတယ်
                  <span className="cb-dot">.</span>
                  <span className="cb-dot" style={{ animationDelay: '.2s' }}>.</span>
                  <span className="cb-dot" style={{ animationDelay: '.4s' }}>.</span>
                </p>
                <p className="text-[12.5px] text-slate-400">ဒီ page ကို မပိတ်ပါနဲ့</p>
              </div>
            )}

            {phase === 'result' && result && st === 'approved' && (
              <>
                <div className="flex flex-col items-center gap-1.5 px-5 pb-5 pt-3 text-center">
                  <CityBot pose="done" size={180} label="City Bot is celebrating" />
                  <p className="text-[15px] text-emerald-200">Wallet ထဲ ထည့်ပြီးပါပြီ</p>
                  <p className="text-[40px] font-semibold tracking-tight text-white tabular-nums">
                    +{(result.amount ?? 0).toLocaleString()} <span className="text-lg font-medium text-slate-300">Ks</span>
                  </p>
                </div>
                {typeof result.balance === 'number' && (
                  <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3.5">
                    <span className="text-[13px] text-slate-400">Wallet balance</span>
                    <span className="text-base font-semibold text-slate-50 tabular-nums">{result.balance.toLocaleString()} Ks</span>
                  </div>
                )}
                <div className="flex flex-col gap-2 px-5 pb-5">
                  <Link href="/" className="flex h-[50px] items-center justify-center rounded-2xl bg-emerald-500 text-[15px] font-bold text-emerald-950">
                    ဆက်ဝယ်မယ်
                  </Link>
                  <button type="button" onClick={closeResult} className="h-[46px] rounded-2xl text-sm text-slate-300 hover:text-white">
                    နောက်ထပ် ငွေဖြည့်မယ်
                  </button>
                </div>
              </>
            )}

            {phase === 'result' && result && st === 'manual_review' && (
              <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-3 text-center">
                <CityBot pose="hello" size={170} label="City Bot" />
                <p className="text-[17px] font-semibold text-slate-50">စစ်ဆေးနေပါပြီ</p>
                <p className="text-[13.5px] leading-relaxed text-slate-300">{result.reason_mm}</p>
                {result.amount ? <p className="text-sm text-slate-400 tabular-nums">{result.amount.toLocaleString()} Ks</p> : null}
                <button type="button" onClick={closeResult} className="mt-3 h-[50px] w-full rounded-2xl bg-emerald-500 text-[15px] font-bold text-emerald-950">
                  OK
                </button>
              </div>
            )}

            {phase === 'result' && result && st === 'need_amount' && (
              <form
                className="flex flex-col items-center gap-2 px-5 pb-5 pt-3 text-center"
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(typedAmount);
                  if (n > 0) submit(n);
                }}
              >
                <CityBot pose="hello" size={150} label="City Bot" />
                <label htmlFor="kbz-amount" className="text-[15px] font-semibold text-slate-50">
                  {result.reason_mm}
                </label>
                <input
                  id="kbz-amount"
                  value={typedAmount}
                  onChange={(e) => setTypedAmount(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  autoFocus
                  placeholder="Ks"
                  className="mt-1 h-12 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-center text-lg text-slate-50 outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!(Number(typedAmount) > 0)}
                  className="mt-2 h-[50px] w-full rounded-2xl bg-emerald-500 text-[15px] font-bold text-emerald-950 disabled:bg-slate-800 disabled:text-slate-500"
                >
                  ငွေဖြည့်မယ်
                </button>
                <button type="button" onClick={closeResult} className="h-10 text-sm text-slate-400 hover:text-white">
                  မလုပ်တော့ပါ
                </button>
              </form>
            )}

            {phase === 'result' && result && (st === 'rejected' || st === 'qr_not_found' || st === 'unreadable') && (
              <div className="flex flex-col items-center gap-2 px-5 pb-5 pt-3 text-center">
                <CityBot pose="oops" size={160} label="City Bot looks sad" />
                <p className="text-[17px] font-semibold text-slate-50">
                  {st === 'rejected' ? 'ငွေဖြည့်လို့ မရပါ' : 'Slip ကို ပြန်တင်ပေးပါ'}
                </p>
                <p className="text-[13.5px] leading-relaxed text-slate-300">{result.reason_mm}</p>
                <p className="text-[11px] text-slate-500">{result.reason_en}</p>
                {st === 'rejected' ? (
                  <button type="button" onClick={closeResult} className="mt-3 h-[50px] w-full rounded-2xl bg-slate-800 text-[15px] font-semibold text-slate-100">
                    ပိတ်မယ်
                  </button>
                ) : (
                  <button type="button" onClick={retryUpload} className="mt-3 h-[50px] w-full rounded-2xl bg-emerald-500 text-[15px] font-bold text-emerald-950">
                    Slip ပြန်ရွေးမယ်
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
