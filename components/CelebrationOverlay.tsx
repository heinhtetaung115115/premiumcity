'use client';

import { useEffect, useState } from 'react';

type Props = {
  show: boolean;
  onClose: () => void;
  amount?: number;
};

// Lightweight confetti + congrats card. No external libraries.
export function CelebrationOverlay({ show, onClose, amount = 1000 }: Props) {
  const [pieces, setPieces] = useState<
    { id: number; left: number; delay: number; duration: number; color: string; rotate: number; size: number }[]
  >([]);

  useEffect(() => {
    if (!show) return;
    const colors = ['#10b981', '#34d399', '#fbbf24', '#f59e0b', '#38bdf8', '#a78bfa', '#f472b6'];
    const arr = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotate: Math.random() * 360,
      size: 6 + Math.random() * 8,
    }));
    setPieces(arr);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Confetti layer */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: '-20px',
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 0.5}px`,
              background: p.color,
              borderRadius: '2px',
              transform: `rotate(${p.rotate}deg)`,
              animation: `celeb-fall ${p.duration}s linear ${p.delay}s forwards`,
            }}
          />
        ))}
      </div>

      {/* Congrats card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-xs overflow-hidden rounded-3xl border border-emerald-500/40 bg-slate-950 p-6 text-center shadow-2xl"
        style={{ animation: 'celeb-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
      >
        <div
          className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 text-5xl"
          style={{ animation: 'celeb-bounce 0.6s ease-out 0.2s both' }}
        >
          🎉
        </div>
        <h2 className="text-xl font-bold text-emerald-300">Yayyy! 🥳</h2>
        <p className="mt-2 text-sm text-slate-200">
          ဂုဏ်ယူပါတယ်! သင် <span className="font-bold text-amber-300">{amount.toLocaleString()} ကျပ်</span>{' '}
          ရရှိပါပြီ
        </p>
        <p className="mt-1 text-[12px] text-slate-400">
          သင့် Wallet ထဲ ထည့်သွင်းပြီးပါပြီ
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
        >
          အိုကေ
        </button>
      </div>

      <style>{`
        @keyframes celeb-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(105vh) rotate(720deg); opacity: 0.9; }
        }
        @keyframes celeb-pop {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes celeb-bounce {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
