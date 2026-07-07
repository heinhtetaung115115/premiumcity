'use client';

import { useState } from 'react';
import type { ProductInputField } from '@/types/product';

function slugifyId(label: string, fallback: string) {
  const id = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return id || fallback;
}

type Row = { label: string; required: boolean };

export function ManualFieldsBuilder({
  initial = [],
  compact = false,
}: {
  initial?: ProductInputField[];
  compact?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial.length > 0
      ? initial.map((f) => ({ label: f.label, required: !!f.required }))
      : []
  );

  // Build the schema JSON that the server action reads (name="manualFields").
  const schema: ProductInputField[] = rows
    .filter((r) => r.label.trim())
    .map((r, i) => ({
      id: slugifyId(r.label, `field_${i + 1}`),
      label: r.label.trim(),
      required: r.required,
    }));

  const json = schema.length > 0 ? JSON.stringify(schema) : '';

  function addRow() {
    setRows((r) => [...r, { label: '', required: true }]);
  }
  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function updateLabel(i: number, label: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, label } : row)));
  }
  function toggleRequired(i: number) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, required: !row.required } : row)));
  }

  const inputCls =
    'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none focus:border-emerald-500';

  return (
    <div className="space-y-2">
      {/* Hidden input the server action reads */}
      <input type="hidden" name="manualFields" value={json} />

      <label className="block text-[11px] uppercase tracking-wide text-slate-500">
        Customer input fields {compact ? '' : '(for manual products)'}
      </label>

      {rows.length === 0 && (
        <p className="text-[11px] text-slate-500">
          No input fields. Add one if you need the customer to provide info (e.g. game ID, username).
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={row.label}
              onChange={(e) => updateLabel(i, e.target.value)}
              placeholder={`Field ${i + 1} label (e.g. Game ID)`}
              className={inputCls}
            />
            <label className="flex flex-shrink-0 items-center gap-1 text-[11px] text-slate-400">
              <input
                type="checkbox"
                checked={row.required}
                onChange={() => toggleRequired(i)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 accent-emerald-500"
              />
              Required
            </label>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-rose-400 hover:text-rose-300"
              title="Remove field"
              aria-label="Remove field"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition hover:border-emerald-500 hover:text-emerald-300"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Add input field
      </button>
    </div>
  );
}
