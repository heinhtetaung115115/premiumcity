'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addInventoryAction } from './actions';

type Kind = 'email_password' | 'key' | 'invite_link' | 'note';
type Variant = { id: string; name: string | null };

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending && (
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      )}
      <span>{pending ? 'Uploading…' : 'Add stock'}</span>
    </button>
  );
}

export function InventoryUploadForm({
  productId,
  variants,
}: {
  productId: string;
  variants: Variant[];
}) {
  const [kind, setKind] = useState<Kind>('email_password');
  const [bulk, setBulk] = useState(false);

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500';

  const canBulk = kind === 'email_password' || kind === 'key' || kind === 'invite_link';

  return (
    <form action={addInventoryAction as any} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="kind" value={kind} />

      {/* Variant selector (optional) */}
      {variants.length > 0 ? (
        <div>
          <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
            Variant (optional)
          </label>
          <select name="variantId" className={inputCls}>
            <option value="">— No specific variant —</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name || v.id}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="variantId" value="" />
      )}

      {/* Type selector */}
      <div>
        <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
          Stock type
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            { v: 'email_password', label: 'Email : Password' },
            { v: 'key', label: 'Key' },
            { v: 'invite_link', label: 'Invite Link' },
            { v: 'note', label: 'Note' },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setKind(opt.v)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                kind === opt.v
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk toggle */}
      {canBulk && (
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input
            type="checkbox"
            checked={bulk}
            onChange={(e) => setBulk(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-emerald-500"
          />
          Bulk upload (many at once, one per line)
        </label>
      )}

      {/* ── EMAIL : PASSWORD ── */}
      {kind === 'email_password' && !bulk && (
        <div className="space-y-2">
          <input name="email" type="text" placeholder="Email" className={inputCls} />
          <input name="password" type="text" placeholder="Password" className={inputCls} />
          <input name="note" type="text" placeholder="Note (optional)" className={inputCls} />
        </div>
      )}

      {kind === 'email_password' && bulk && (
        <div className="space-y-2">
          <textarea
            name="bulk"
            rows={5}
            placeholder={'One per line:\nemail,password\nemail,password,note'}
            className={`${inputCls} font-mono`}
          />
          <p className="text-[10px] text-slate-500">
            Format: email,password[,note] — one account per line.
          </p>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
              Shared note for all accounts (optional)
            </label>
            <textarea
              name="sharedNote"
              rows={3}
              placeholder="This note is added to every account above (use when your note is long). A per-line note overrides this."
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* ── KEY ── */}
      {kind === 'key' && !bulk && (
        <div className="space-y-2">
          <input name="key" type="text" placeholder="Redeem key / code" className={inputCls} />
          <input name="note" type="text" placeholder="Note (optional)" className={inputCls} />
        </div>
      )}
      {kind === 'key' && bulk && (
        <div className="space-y-2">
          <textarea
            name="bulk"
            rows={5}
            placeholder={'One key per line:\nXXXX-XXXX-XXXX\nYYYY-YYYY-YYYY'}
            className={`${inputCls} font-mono`}
          />
          <p className="text-[10px] text-slate-500">One key per line.</p>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
              Shared note for all keys (optional)
            </label>
            <textarea
              name="sharedNote"
              rows={3}
              placeholder="This note is added to every key above."
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* ── INVITE LINK ── */}
      {kind === 'invite_link' && !bulk && (
        <div className="space-y-2">
          <input name="inviteLink" type="text" placeholder="https://…" className={inputCls} />
          <input name="note" type="text" placeholder="Note (optional)" className={inputCls} />
        </div>
      )}
      {kind === 'invite_link' && bulk && (
        <div className="space-y-2">
          <textarea
            name="bulk"
            rows={5}
            placeholder={'One link per line:\nhttps://example.com/invite/1\nhttps://example.com/invite/2'}
            className={`${inputCls} font-mono`}
          />
          <p className="text-[10px] text-slate-500">One link per line.</p>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-500">
              Shared note for all links (optional)
            </label>
            <textarea
              name="sharedNote"
              rows={3}
              placeholder="This note is added to every link above."
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* ── NOTE ── */}
      {kind === 'note' && (
        <textarea
          name="note"
          rows={3}
          placeholder="Note / instructions delivered to the customer"
          className={inputCls}
        />
      )}

      <div className="flex justify-end">
        <UploadButton />
      </div>
    </form>
  );
}
