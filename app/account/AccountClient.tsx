'use client';

import { useState, useRef } from 'react';
import { signOut } from 'next-auth/react';
import {
  updateUsernameAction,
  updateAvatarAction,
  removeAvatarAction,
  claimProfileRewardAction,
} from './actions';
import { PRESET_AVATARS } from '@/components/preset-avatars';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';

type Props = {
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string | null;
  balance: number;
  rewardClaimed: boolean;
};

export function AccountClient({ email, name, avatarUrl, createdAt, balance, rewardClaimed }: Props) {
  const [currentName, setCurrentName] = useState(name);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(avatarUrl);
  const [currentBalance, setCurrentBalance] = useState(balance);
  const [claimed, setClaimed] = useState(rewardClaimed);
  const [claiming, setClaiming] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function fileToCompressedDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const size = 256;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas not supported'));
          const min = Math.min(img.width, img.height);
          const sx = (img.width - min) / 2;
          const sy = (img.height - min) / 2;
          ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error('Could not load image'));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });
  }

  async function saveAvatar(dataUrl: string) {
    const fd = new FormData();
    fd.set('avatar', dataUrl);
    const res = await updateAvatarAction(fd);
    if (res.success) {
      setCurrentAvatar(dataUrl);
      setMsg({ type: 'ok', text: 'Profile photo updated.' });
      setShowPresets(false);
    } else {
      setMsg({ type: 'err', text: res.error || 'Could not update photo.' });
    }
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsg(null);
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: 'Please choose an image file.' });
      return;
    }
    setUploadingPhoto(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      await saveAvatar(dataUrl);
    } catch (err: any) {
      setMsg({ type: 'err', text: err?.message || 'Could not process image.' });
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handlePickPreset(url: string) {
    setMsg(null);
    setUploadingPhoto(true);
    try {
      await saveAvatar(url);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    setMsg(null);
    setUploadingPhoto(true);
    const res = await removeAvatarAction();
    setUploadingPhoto(false);
    if (res.success) {
      setCurrentAvatar(null);
      setMsg({ type: 'ok', text: 'Profile photo removed.' });
    } else {
      setMsg({ type: 'err', text: res.error || 'Could not remove photo.' });
    }
  }

  const profileComplete = currentName.trim().length >= 2 && !!currentAvatar;

  async function handleClaimReward() {
    setClaimMsg(null);
    if (!profileComplete) {
      setClaimMsg('အမည်နှင့် ပရိုဖိုင်ဓာတ်ပုံ အရင်ထည့်ပါ။');
      return;
    }
    setClaiming(true);
    const res = await claimProfileRewardAction();
    setClaiming(false);
    if (res.success) {
      if (typeof res.newBalance === 'number') setCurrentBalance(res.newBalance);
      setClaimMsg(null);
      setShowCelebration(true); // 🎉 celebrate first
    } else {
      setClaimMsg(res.error || 'ရယူ၍ မရပါ။ ထပ်စမ်းကြည့်ပါ။');
    }
  }

  function closeCelebration() {
    setShowCelebration(false);
    setClaimed(true); // now hide the banner
  }

  return (
    <main className="mx-auto max-w-md px-4 py-6 sm:py-8">
      {/* 🎉 Celebration overlay on successful claim */}
      <CelebrationOverlay show={showCelebration} onClose={closeCelebration} amount={1000} />

      <h1 className="mb-6 text-xl font-semibold text-slate-50">My Account</h1>

      {/* ── Profile completion reward banner ── */}
      {!claimed && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-emerald-500/10 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xl">🎁</span>
            <p className="text-sm font-semibold text-amber-200">အခမဲ့ ၁,၀၀၀ ကျပ် ရယူပါ</p>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-300">
            သင့်ရဲ့ အမည်နှင့် ပရိုဖိုင်ဓာတ်ပုံ ထည့်သွင်းပြီး ၁,၀၀၀ ကျပ် လက်ဆောင်ကို Wallet ထဲ တစ်ကြိမ်တည်း ရယူလိုက်ပါ။
          </p>
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className={currentName.trim().length >= 2 ? 'text-emerald-400' : 'text-slate-500'}>
                {currentName.trim().length >= 2 ? '✓' : '○'}
              </span>
              <span className={currentName.trim().length >= 2 ? 'text-slate-300' : 'text-slate-500'}>
                အမည် ထည့်သွင်းပါ
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className={currentAvatar ? 'text-emerald-400' : 'text-slate-500'}>
                {currentAvatar ? '✓' : '○'}
              </span>
              <span className={currentAvatar ? 'text-slate-300' : 'text-slate-500'}>
                ပရိုဖိုင်ဓာတ်ပုံ ထည့်သွင်းပါ
              </span>
            </div>
          </div>
          <button
            onClick={handleClaimReward}
            disabled={!profileComplete || claiming}
            className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${
              profileComplete
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'cursor-not-allowed bg-slate-800 text-slate-500'
            }`}
          >
            {claiming ? 'ရယူနေသည်…' : profileComplete ? '၁,၀၀၀ ကျပ် ရယူမည်' : 'ပရိုဖိုင် ပြည့်စုံမှ ရယူနိုင်မည်'}
          </button>
          {claimMsg && <p className="mt-2 text-xs text-rose-400">{claimMsg}</p>}
        </div>
      )}

      {/* Profile card with photo */}
      <div className="mb-5 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            {currentAvatar ? (
              <img src={currentAvatar} alt="Profile" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-xl font-bold text-slate-950">
                {initials}
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              aria-label="Change photo"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-slate-50">
              {currentName || 'No name set'}
            </p>
            <p className="truncate text-sm text-slate-400">{email}</p>
            {currentAvatar && (
              <button
                onClick={handleRemovePhoto}
                disabled={uploadingPhoto}
                className="mt-1 text-[11px] text-rose-400 hover:text-rose-300"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Photo options */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex-1 rounded-xl border border-slate-700 py-2 text-xs font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-60"
          >
            📷 Upload photo
          </button>
          <button
            onClick={() => setShowPresets((s) => !s)}
            disabled={uploadingPhoto}
            className="flex-1 rounded-xl border border-slate-700 py-2 text-xs font-medium text-slate-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-60"
          >
            😀 Choose avatar
          </button>
        </div>

        {/* Preset avatar grid */}
        {showPresets && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            <p className="mb-2 text-[11px] text-slate-400">Pick a ready-made avatar</p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_AVATARS.map((av) => {
                const selected = currentAvatar === av.url;
                return (
                  <button
                    key={av.id}
                    onClick={() => handlePickPreset(av.url)}
                    disabled={uploadingPhoto}
                    title={av.label}
                    className={`overflow-hidden rounded-xl border-2 transition ${
                      selected ? 'border-emerald-500' : 'border-transparent hover:border-slate-600'
                    }`}
                  >
                    <img src={av.url} alt={av.label} className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {uploadingPhoto && <p className="mt-3 text-xs text-emerald-400">Saving photo…</p>}
      </div>

      {/* Wallet balance */}
      <div className="mb-5 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5">
        <p className="text-[13px] text-emerald-50/90">Wallet balance</p>
        <p className="text-2xl font-semibold text-white">
          {currentBalance.toLocaleString()} <span className="text-base">KS</span>
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
          <p className={`mt-3 text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
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

      <div className="mb-5 rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4">
        <p className="text-xs text-slate-500">
          More settings coming soon — change password, notification preferences, and more.
        </p>
      </div>

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
