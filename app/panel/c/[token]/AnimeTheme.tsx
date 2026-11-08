'use client';

// Anime theme for the Crunchyroll customer page.
// "Kitsu" is an ORIGINAL mascot (chibi fox spirit with headphones) — not any
// existing character. Pure SVG + CSS, no images, respects reduced motion.

export type MascotMood = 'idle' | 'search' | 'happy';

export function AnimeStyles() {
  return (
    <style>{`
      @keyframes pc-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
      @keyframes pc-blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
      @keyframes pc-wave { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(18deg) } }
      @keyframes pc-look { 0%,100% { transform: translateX(-3px) } 50% { transform: translateX(3px) } }
      @keyframes pc-tail { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(10deg) } }
      @keyframes pc-fall {
        0% { transform: translate3d(0,-10vh,0) rotate(0deg); opacity: 0 }
        10% { opacity: .9 }
        100% { transform: translate3d(var(--drift),110vh,0) rotate(540deg); opacity: .2 }
      }
      @keyframes pc-pop { 0% { transform: scale(.6); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
      .pc-bob { animation: pc-bob 2.6s ease-in-out infinite; }
      .pc-blink { transform-box: fill-box; transform-origin: center; animation: pc-blink 4.2s infinite; }
      .pc-wave { transform-box: fill-box; transform-origin: 20% 90%; animation: pc-wave 1.1s ease-in-out infinite; }
      .pc-look { animation: pc-look 1.2s ease-in-out infinite; }
      .pc-tail { transform-box: fill-box; transform-origin: 10% 90%; animation: pc-tail 1.8s ease-in-out infinite; }
      .pc-pop { animation: pc-pop .35s cubic-bezier(.2,.9,.3,1.3) both; }
      @media (prefers-reduced-motion: reduce) {
        .pc-bob,.pc-blink,.pc-wave,.pc-look,.pc-tail,.pc-petal { animation: none !important; }
      }
    `}</style>
  );
}

/** Original chibi fox-spirit mascot. */
export function Mascot({ mood = 'idle', size = 96 }: { mood?: MascotMood; size?: number }) {
  const ink = '#1d1b2e';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="pc-bob drop-shadow-[0_8px_18px_rgba(244,117,33,0.35)]" aria-hidden>
      {/* tail */}
      <g className="pc-tail">
        <path d="M86 92 C112 92 116 64 104 54 C106 70 98 80 84 82 Z" fill="#f47521" />
        <path d="M104 54 C108 60 108 66 106 70 C102 64 101 59 104 54 Z" fill="#fff4e8" />
      </g>
      {/* ears */}
      <path d="M30 44 L22 12 L50 32 Z" fill="#f47521" />
      <path d="M90 44 L98 12 L70 32 Z" fill="#f47521" />
      <path d="M31 38 L27 20 L43 32 Z" fill="#ffb3c7" />
      <path d="M89 38 L93 20 L77 32 Z" fill="#ffb3c7" />
      {/* body */}
      <ellipse cx="60" cy="70" rx="42" ry="38" fill="#f47521" />
      <ellipse cx="60" cy="84" rx="26" ry="20" fill="#fff4e8" />
      {/* face patch */}
      <path d="M30 70 C34 52 50 46 60 54 C70 46 86 52 90 70 C82 84 38 84 30 70 Z" fill="#fff4e8" />
      {/* headphones */}
      <path d="M22 62 C22 22 98 22 98 62" fill="none" stroke={ink} strokeWidth="5" strokeLinecap="round" />
      <rect x="14" y="56" width="14" height="22" rx="6" fill={ink} />
      <rect x="92" y="56" width="14" height="22" rx="6" fill={ink} />
      <rect x="17" y="60" width="5" height="14" rx="2.5" fill="#ff8a3d" />
      <rect x="98" y="60" width="5" height="14" rx="2.5" fill="#ff8a3d" />
      {/* eyes */}
      {mood === 'happy' ? (
        <>
          <path d="M38 68 Q45 60 52 68" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
          <path d="M68 68 Q75 60 82 68" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        </>
      ) : (
        <g className="pc-blink">
          <g className={mood === 'search' ? 'pc-look' : ''}>
            <ellipse cx="45" cy="67" rx="7.5" ry="10" fill={ink} />
            <ellipse cx="75" cy="67" rx="7.5" ry="10" fill={ink} />
            <ellipse cx="45" cy="70" rx="5" ry="5" fill="#ff8a3d" opacity=".55" />
            <ellipse cx="75" cy="70" rx="5" ry="5" fill="#ff8a3d" opacity=".55" />
            <circle cx="42.5" cy="63" r="2.8" fill="#fff" />
            <circle cx="72.5" cy="63" r="2.8" fill="#fff" />
            <circle cx="47.5" cy="71" r="1.3" fill="#fff" />
            <circle cx="77.5" cy="71" r="1.3" fill="#fff" />
          </g>
        </g>
      )}
      {/* blush */}
      <ellipse cx="34" cy="79" rx="6" ry="3.5" fill="#ff7aa2" opacity=".55" />
      <ellipse cx="86" cy="79" rx="6" ry="3.5" fill="#ff7aa2" opacity=".55" />
      {/* nose + mouth */}
      <path d="M58 75 L62 75 L60 77.5 Z" fill={ink} />
      {mood === 'search' ? (
        <ellipse cx="60" cy="83" rx="2.6" ry="3" fill={ink} />
      ) : (
        <path d="M53 80 Q56.5 84 60 80 Q63.5 84 67 80" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      )}
      {/* waving paw */}
      {mood !== 'search' && (
        <g className="pc-wave">
          <ellipse cx="98" cy="86" rx="8" ry="10" fill="#f47521" />
          <ellipse cx="99" cy="81" rx="4.5" ry="4" fill="#fff4e8" />
        </g>
      )}
      {/* magnifier when searching */}
      {mood === 'search' && (
        <g>
          <circle cx="96" cy="88" r="9" fill="rgba(255,255,255,.25)" stroke={ink} strokeWidth="3.5" />
          <path d="M102 95 L110 104" stroke={ink} strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      {/* sparkle when happy */}
      {mood === 'happy' && (
        <path d="M16 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#ffd166" className="pc-pop" />
      )}
    </svg>
  );
}

const PETALS = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: -((i * 1.7) % 12),
  dur: 9 + ((i * 3) % 7),
  size: 9 + ((i * 5) % 8),
  drift: `${((i % 2 ? 1 : -1) * (20 + ((i * 13) % 60)))}px`,
}));

/** Falling sakura petals + halftone dots behind the page. */
export function AnimeBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'radial-gradient(#f47521 1px, transparent 1.4px)', backgroundSize: '14px 14px' }}
      />
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#f47521]/10 blur-3xl" />
      <div className="absolute -right-24 bottom-24 h-72 w-72 rounded-full bg-pink-500/10 blur-3xl" />
      {PETALS.map((p, i) => (
        <span
          key={i}
          className="pc-petal absolute top-0"
          style={{
            left: `${p.left}%`,
            animation: `pc-fall ${p.dur}s linear ${p.delay}s infinite`,
            ['--drift' as any]: p.drift,
          }}
        >
          <svg width={p.size} height={p.size} viewBox="0 0 20 20">
            <path d="M10 1 C15 5 17 11 10 19 C3 11 5 5 10 1 Z" fill={i % 3 ? '#ffb7c9' : '#ffd3de'} opacity=".85" />
          </svg>
        </span>
      ))}
    </div>
  );
}

/** Manga speed lines for the header card. */
export function SpeedLines() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.10]"
      style={{
        backgroundImage:
          'repeating-conic-gradient(from 0deg at 85% 60%, #ffffff 0deg 1.2deg, transparent 1.2deg 9deg)',
        maskImage: 'radial-gradient(circle at 85% 60%, transparent 18%, black 60%)',
        WebkitMaskImage: 'radial-gradient(circle at 85% 60%, transparent 18%, black 60%)',
      }}
      aria-hidden
    />
  );
}

/** Small speech bubble next to the mascot. */
export function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="pc-pop relative rounded-2xl border-2 border-[#1d1b2e] bg-white px-3 py-2 text-[12.5px] font-semibold leading-snug text-[#1d1b2e] shadow-[3px_3px_0_#f47521]">
      {children}
      <span className="absolute -left-[7px] bottom-3 h-3 w-3 rotate-45 border-b-2 border-l-2 border-[#1d1b2e] bg-white" />
    </div>
  );
}
