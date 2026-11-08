'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Seasonal winter theme (snow, lights, snowman, logo hat, snowy tiles).
 * Turn the whole theme off after the holidays by setting this to false.
 */
export const WINTER_THEME_ENABLED = true;

// No snow on admin screens.
function isQuietPath(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/panel');
}

/* ───────────── Falling snow (whole page) ───────────── */

type Flake = { left: number; size: number; op: number; dx: number; dur: number; delay: number };

function makeFlakes(count: number): Flake[] {
  let seed = 7; // fixed seed so server and browser render the same flakes
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  return Array.from({ length: count }, () => {
    const size = 2 + Math.round(rnd() * 5);
    return {
      left: +(rnd() * 100).toFixed(1),
      size,
      op: +(0.45 + rnd() * 0.5).toFixed(2),
      dx: Math.round(rnd() * 60 - 30),
      dur: +(9 + rnd() * 10).toFixed(1),
      delay: +(-rnd() * 18).toFixed(1),
    };
  });
}

const FLAKES = makeFlakes(45);

export function Snowfall() {
  const pathname = usePathname() || '/';
  if (!WINTER_THEME_ENABLED || isQuietPath(pathname)) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[45] overflow-hidden">
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="pc-flake"
          style={
            {
              left: `${f.left}%`,
              width: f.size,
              height: f.size,
              opacity: f.op,
              animationDuration: `${f.dur}s`,
              animationDelay: `${f.delay}s`,
              filter: f.size <= 3 ? 'blur(0.6px)' : undefined,
              '--dx': `${f.dx}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ───────────── Lights hanging under the navbar ───────────── */

const BULB_COLORS = ['#f87171', '#facc15', '#34d399', '#7dd3fc', '#fb923c', '#c084fc'];
const BULBS = Array.from({ length: 64 }, (_, i) => {
  const x = 16 + i * 32.5;
  const phase = (x % 65) / 65;
  const y = 13 + Math.sin(phase * Math.PI) * 9;
  return { x, y, color: BULB_COLORS[i % BULB_COLORS.length], delay: (i % 4) * 0.4 };
});

export function WinterLights() {
  if (!WINTER_THEME_ENABLED) return null;
  // Repeat the 65px swag across a wide strip; the header clips it to the screen.
  let wire = 'M0 4';
  for (let x = 0; x < 2100; x += 65) wire += ` Q ${x + 32.5} 22 ${x + 65} 4`;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-full h-[30px] overflow-hidden">
      <svg width="2100" height="30" viewBox="0 0 2100 30">
        <path d={wire} fill="none" stroke="#334155" strokeWidth="1.5" />
        {BULBS.map((b, i) => (
          <g key={i} className="pc-bulb" style={{ animationDelay: `${b.delay}s` }}>
            <rect x={b.x - 2} y={b.y - 8} width="4" height="4" rx="1" fill="#64748b" />
            <ellipse cx={b.x} cy={b.y} rx="4" ry="5.5" fill={b.color} />
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ───────────── Little pieces ───────────── */

export function LogoHat() {
  if (!WINTER_THEME_ENABLED) return null;
  return (
    <svg
      aria-hidden="true"
      width="30"
      height="26"
      viewBox="0 0 30 26"
      className="pointer-events-none absolute -left-[9px] -top-[14px] -rotate-[22deg]"
    >
      <path d="M3 20 C6 9 13 3 21 4 C25 5 27 9 26 13 C22 10 18 11 16 15 Z" fill="#dc2626" />
      <rect x="1" y="17" width="20" height="6" rx="3" fill="#f8fafc" />
      <circle cx="26" cy="14" r="3.4" fill="#f8fafc" />
    </svg>
  );
}

/** Wavy snow layer for the top edge of a card. Parent must be relative + overflow-hidden. */
export function SnowCap({ className = '' }: { className?: string }) {
  if (!WINTER_THEME_ENABLED) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 358 22"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute left-0 top-0 h-[22px] w-full ${className}`}
    >
      <path
        d="M0 0 H358 V8 C340 14 330 10 318 12 C306 22 298 12 286 11 C268 9 262 16 244 12 C226 8 214 18 200 12 C186 7 176 13 160 11 C146 9 140 20 128 12 C114 4 100 14 84 11 C70 9 62 17 48 12 C34 8 20 14 0 9 Z"
        fill="#f8fafc"
      />
    </svg>
  );
}

/** Small snow lump for category tiles. Parent must be relative. */
export function TileSnow() {
  if (!WINTER_THEME_ENABLED) return null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 66 10"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -top-px left-0 h-[10px] w-full"
    >
      <path
        d="M6 1 H60 C64 1 65 3 63 5 C58 8 54 4 48 6 C42 9 38 3 30 6 C24 8 18 4 12 6 C6 8 2 5 3 3 C4 1 5 1 6 1 Z"
        fill="#f1f5f9"
      />
    </svg>
  );
}

export function Snowman({ className = '' }: { className?: string }) {
  if (!WINTER_THEME_ENABLED) return null;
  return (
    <svg aria-hidden="true" width="74" height="86" viewBox="0 -6 74 92" className={`pointer-events-none ${className}`}>
      <g className="pc-arm">
        <path d="M14 46 L2 34 M6 38 L2 40 M6 38 L5 33" stroke="#7c4a24" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      </g>
      <path d="M60 48 L72 38 M68 41 L72 43 M68 41 L69 36" stroke="#7c4a24" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle cx="37" cy="64" r="22" fill="#f8fafc" />
      <circle cx="37" cy="30" r="16" fill="#f8fafc" />
      <path d="M22 41 Q37 49 52 41 L52 47 Q37 55 22 47 Z" fill="#10b981" />
      <path d="M44 45 L48 60 L41 59 Z" fill="#059669" />
      <rect x="24" y="8" width="26" height="6" rx="2" fill="#0f172a" />
      <rect x="28" y="-4" width="18" height="14" rx="2" fill="#0f172a" />
      <rect x="28" y="6" width="18" height="3" fill="#dc2626" />
      <circle cx="31" cy="27" r="1.9" fill="#0f172a" />
      <circle cx="43" cy="27" r="1.9" fill="#0f172a" />
      <path d="M37 31 L47 34 L37 35 Z" fill="#f97316" />
      <path d="M31 37 Q37 40 43 37" stroke="#0f172a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <circle cx="37" cy="60" r="1.8" fill="#0f172a" />
      <circle cx="37" cy="68" r="1.8" fill="#0f172a" />
    </svg>
  );
}

/** Snow piled at the bottom of the page (sits just above the footer). */
export function SnowDrift() {
  const pathname = usePathname() || '/';
  if (!WINTER_THEME_ENABLED || isQuietPath(pathname)) return null;
  return (
    <svg aria-hidden="true" viewBox="0 0 390 70" preserveAspectRatio="none" className="pointer-events-none -mb-px block h-[56px] w-full">
      <path d="M0 40 C40 22 70 34 105 26 C140 18 165 36 200 30 C240 22 262 12 300 24 C330 34 360 20 390 28 V70 H0 Z" fill="#e2e8f0" />
      <path d="M0 52 C50 40 90 50 130 44 C180 36 220 52 260 46 C300 40 340 50 390 42 V70 H0 Z" fill="#f8fafc" />
    </svg>
  );
}

/* ───────────── New Year banner: shows itself 1 Dec – 15 Jan (Yangon time) ───────────── */

function yangonNow() {
  // UTC+06:30
  return new Date(Date.now() + 6.5 * 60 * 60 * 1000);
}

export function NewYearBanner() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    if (!WINTER_THEME_ENABLED) return;
    const now = yangonNow();
    const m = now.getUTCMonth(); // 0 = Jan, 11 = Dec
    const d = now.getUTCDate();
    if (m === 11) setYear(now.getUTCFullYear() + 1);
    else if (m === 0 && d <= 15) setYear(now.getUTCFullYear());
  }, []);

  if (!year) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-sky-300/25 bg-gradient-to-r from-sky-500/[0.12] to-emerald-500/10 px-3.5 py-3">
      <svg aria-hidden="true" className="h-7 w-7 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2v20M3.3 7l17.4 10M20.7 7L3.3 17M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-slate-50">Happy New Year {year}</p>
        <p className="mt-0.5 text-xs text-slate-400">ပျော်ရွှင်ဖွယ် နှစ်သစ်ဖြစ်ပါစေ</p>
      </div>
    </div>
  );
}
