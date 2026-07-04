'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { updateUsernameAction } from './actions';

type Props = {
  email: string;
  name: string;
  createdAt: string | null;
  balance: number;
};

export function AccountClient({ email, name, createdAt, balance }: Props) {
  const [currentName, setCurrentName] = useState(name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const initials = (currentName || email || 'A')
    .split(' ')
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleSave() {
    setMsg(null);
    if (draft.trim().length < 2) {
      setMsg({ type: 'err', text: 'Name must be at least 2 characters.' });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    fd.set('name', draft.trim());
    const res = await updateUsernameAction(fd);
    setSaving(false);

    if (res.success) {
      setCurrentName(draft.trim());
      setEditing(false);
      setMsg({ type: 'ok', text: 'Name updated successfully.' });
    } else {
      setMsg({ type: 'err', text: res.error || 'Could not update name.' });
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6 sm:py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-50">My Account</h1>

      {/* Profile card */}
      <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl font-bold text-slate-950">
            {initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-50">
              {currentName || 'No name set'}
            </p>
            <p className="truncate text-sm text-slate-400">{email}</p>
          </div>
        </div>
      </div>

      {/* Wallet balance */}
      <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5">
        <p className="text-[13px] text-emerald-50/90">Wallet balance</p>
        <p className="text-2xl font-semibold text-white">
          {balance.toLocaleString()} <span className="text-base">KS</span>
        </p>
      </div>

      {/* Username editor */}
      <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">Display name</p>
          {!editing && (
            <button
              onClick={() => {
                setDraft(currentName);
                setEditing(true);
                setMsg(null);
              }}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Enter your name"
              maxLength={40}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-slate-50 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setMsg(null);
                }}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-300">{currentName || 'No name set yet'}</p>
        )}

        {msg && (
          <p
            className={`mt-3 text-xs ${
              msg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {msg.text}
          </p>
        )}
      </div>

      {/* Account info */}
      <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <p className="mb-3 text-sm font-semibold text-slate-100">Account info</p>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Email</span>
            <span className="text-slate-300">{email}</span>
          </div>
          {createdAt && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Member since</span>
              <span className="text-slate-300">
                {new Date(createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Coming soon note */}
      <div className="mb-5 rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4">
        <p className="text-xs text-slate-500">
          More settings coming soon — change password, notification preferences, and more.
        </p>
      </div>

      {/* Logout */}
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/40 bg-rose-500/10 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Log out
      </button>
    </main>
  );
}
