'use client';

import { useState } from 'react';

type Tag = { key: string; value: string };

/**
 * Simple tag editor for the admin product form.
 * Renders add/remove rows and outputs the tags as JSON
 * into a hidden input named "tags" so the server action can read it.
 */
export function TagEditor({ initial }: { initial?: Tag[] }) {
  const [tags, setTags] = useState<Tag[]>(
    initial && initial.length ? initial : []
  );

  function update(i: number, field: 'key' | 'value', val: string) {
    setTags((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)));
  }

  function add() {
    if (tags.length >= 10) return;
    setTags((prev) => [...prev, { key: '', value: '' }]);
  }

  function remove(i: number) {
    setTags((prev) => prev.filter((_, idx) => idx !== i));
  }

  const cleaned = tags
    .map((t) => ({ key: t.key.trim(), value: t.value.trim() }))
    .filter((t) => t.key && t.value);

  return (
    <div className="md:col-span-2">
      <input type="hidden" name="tags" value={JSON.stringify(cleaned)} />
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-400">
          Tags (e.g. Plan → Ultra HD, Warranty → 1 Month)
        </label>
        <button
          type="button"
          onClick={add}
          disabled={tags.length >= 10}
          className="rounded border border-slate-700 px-2 py-0.5 text-[11px] text-emerald-300 hover:border-emerald-400 disabled:opacity-50"
        >
          + Add tag
        </button>
      </div>

      {tags.length === 0 && (
        <p className="text-[11px] text-slate-600">No tags. Click "+ Add tag" to add one.</p>
      )}

      <div className="space-y-2">
        {tags.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={t.key}
              onChange={(e) => update(i, 'key', e.target.value)}
              placeholder="Label (e.g. Plan)"
              className="w-1/3 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
            <span className="text-slate-600">:</span>
            <input
              value={t.value}
              onChange={(e) => update(i, 'value', e.target.value)}
              placeholder="Value (e.g. Ultra HD)"
              className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded border border-slate-700 px-2 py-1.5 text-[11px] text-rose-400 hover:border-rose-400"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
