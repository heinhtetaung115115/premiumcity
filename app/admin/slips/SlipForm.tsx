'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SlipResult } from '@/lib/usedSlips';

/** Shrink big phone photos so the upload stays small (QR stays readable). */
async function shrink(file: File): Promise<Blob> {
  if (file.size < 900_000 || !file.type.startsWith('image/')) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), 'image/jpeg', 0.9));
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function SlipForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SlipResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setRes(null);
    try {
      const fd = new FormData(e.currentTarget);
      const f = fileRef.current?.files?.[0];
      fd.delete('slip');
      if (f) fd.append('slip', await shrink(f), 'slip.jpg');
      const resp = await fetch('/api/admin/slips', { method: 'POST', body: fd });
      let r: SlipResult;
      try {
        r = await resp.json();
      } catch {
        r = {
          ok: false,
          error:
            resp.status === 413
              ? 'Photo is too large — crop the screenshot and try again.'
              : resp.status === 504
              ? 'Reading the slip took too long. Type the Transaction No. and save again.'
              : `Server error (${resp.status}). Try again.`,
        };
      }
      setRes(r);
      if (r.ok) {
        formRef.current?.reset();
        setPreview(null);
        router.refresh();
      }
    } catch (err: any) {
      setRes({ ok: false, error: err?.message ?? 'Failed.' });
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none';

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-950/60 p-4 text-center hover:border-emerald-400">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Slip preview" className="max-h-56 rounded-lg" />
        ) : (
          <>
            <span className="text-sm font-semibold text-slate-200">Upload KBZPay slip</span>
            <span className="text-[11px] text-slate-500">Screenshot from the Viber / Telegram customer</span>
          </>
        )}
        <input
          ref={fileRef}
          name="slip"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Transaction No. (only if the slip can&apos;t be read)</span>
          <input
            name="transactionId"
            inputMode="numeric"
            placeholder="e.g. 01003984021234567890"
            className={`${input} ${res?.needManualTid ? 'border-amber-400' : ''}`}
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Amount (optional)</span>
          <input name="amount" inputMode="numeric" placeholder="Ks" className={input} />
        </label>
      </div>
      <input name="note" placeholder="Note (e.g. Ko Aung · Viber · Netflix 1 month)" className={input} />

      <button
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {busy ? 'Reading slip…' : 'Save & block this slip'}
      </button>

      {res && (
        <div
          className={`space-y-2 rounded-xl border p-3 text-xs ${
            res.ok ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200' : 'border-rose-500/30 bg-rose-500/[0.06] text-rose-200'
          }`}
        >
          <p>{res.ok ? res.message : res.error}</p>
          {res.websiteMatches && res.websiteMatches.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">
              <p className="font-semibold">⚠️ This slip was ALREADY used on the website:</p>
              {res.websiteMatches.map((m) => (
                <p key={m.id}>
                  {m.status} · {m.amount.toLocaleString()} Ks · {m.email ?? 'unknown user'} ·{' '}
                  {new Date(m.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Yangon' })}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}
