'use client';

// Anime theme for the Crunchyroll customer page.
// The mascot is an ORIGINAL chibi ninja boy — not any existing character. Pure SVG + CSS, no images, respects reduced motion.

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
      .pc-wave { transform-box: fill-box; transform-origin: 0% 100%; animation: pc-wave 1.1s ease-in-out infinite; }
      .pc-look { animation: pc-look 1.2s ease-in-out infinite; }
      .pc-tail { transform-box: fill-box; transform-origin: 0% 50%; animation: pc-tail 1.8s ease-in-out infinite; }
      .pc-pop { animation: pc-pop .35s cubic-bezier(.2,.9,.3,1.3) both; }
      @media (prefers-reduced-motion: reduce) {
        .pc-bob,.pc-blink,.pc-wave,.pc-look,.pc-tail,.pc-petal { animation: none !important; }
      }
    `}</style>
  );
}

/** Original chibi ninja boy mascot (own design: cloth headband with a gold shuriken, red scarf). */
export function Mascot({ mood = 'idle', size = 96 }: { mood?: MascotMood; size?: number }) {
  const ink = '#151826';
  const skin = '#ffd7b5';
  const suit = '#22263a';
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="pc-bob drop-shadow-[0_8px_18px_rgba(230,57,70,0.35)]" aria-hidden>
      {/* scarf tails flutter behind */}
      <g className="pc-tail">
        <path d="M74 80 C92 78 104 70 114 76 C104 80 98 86 84 88 Z" fill="#e63946" />
        <path d="M76 86 C90 88 100 96 110 94 C100 100 92 98 80 94 Z" fill="#c1121f" />
      </g>
      {/* body + belt */}
      <path d="M38 118 C36 96 44 84 60 84 C76 84 84 96 82 118 Z" fill={suit} />
      <rect x="40" y="100" width="40" height="5" rx="2" fill="#e63946" />

      {/* arms by mood */}
      {mood === 'idle' && (
        <>
          <path d="M40 92 Q30 98 32 108" stroke={suit} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="32" cy="108" r="5" fill={skin} />
          <g className="pc-wave">
            <path d="M80 90 Q94 84 96 72" stroke={suit} strokeWidth="9" strokeLinecap="round" fill="none" />
            <circle cx="96" cy="70" r="5.5" fill={skin} />
          </g>
        </>
      )}
      {mood === 'search' && (
        <>
          <path d="M42 92 Q50 98 56 96" stroke={suit} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M78 92 Q70 98 64 96" stroke={suit} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="55.5" cy="94" r="5.5" fill={skin} />
          <circle cx="64.5" cy="94" r="5.5" fill={skin} />
          <path d="M60 89 L60 99" stroke="#e8b892" strokeWidth="1.4" />
          <g className="pc-blink">
            <path d="M50 84 l-3 -4 M60 82 l0 -5 M70 84 l3 -4" stroke="#ffd166" strokeWidth="2.2" strokeLinecap="round" />
          </g>
        </>
      )}
      {mood === 'happy' && (
        <>
          <path d="M40 92 Q30 98 32 108" stroke={suit} strokeWidth="9" strokeLinecap="round" fill="none" />
          <circle cx="32" cy="108" r="5" fill={skin} />
          <path d="M80 92 Q92 92 94 84" stroke={suit} strokeWidth="9" strokeLinecap="round" fill="none" />
          <rect x="86" y="76" width="14" height="12" rx="4.5" fill={skin} />
          <rect x="85" y="65" width="6" height="14" rx="3" fill={skin} />
          <path d="M91 80 h8 M91 84 h8" stroke="#e8b892" strokeWidth="1.3" strokeLinecap="round" />
          <g className="pc-pop">
            <path d="M14 26 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#ffd166" />
            <path d="M104 18 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#ffd166" />
          </g>
        </>
      )}

      {/* head */}
      <circle cx="60" cy="52" r="30" fill={skin} />
      {/* spiky hair */}
      <path d="M30 46 L26 30 L38 34 L36 18 L50 28 L56 12 L64 26 L74 14 L76 30 L90 22 L86 36 L96 38 L90 46 Z" fill={ink} />
      {/* red cloth headband + embroidered gold shuriken + knot tail */}
      <path d="M29 40 Q60 30 91 40 L91 49 Q60 39 29 49 Z" fill="#c1121f" />
      <path d="M60 36.5 L61.8 40 L65.5 40.6 L61.8 41.2 L60 44.6 L58.2 41.2 L54.5 40.6 L58.2 40 Z" fill="#ffd166" />
      <circle cx="60" cy="40.6" r="1" fill="#2b2f4a" />
      <path d="M91 42 C100 40 106 46 108 52 C102 50 98 48 92 47 Z" fill="#c1121f" />

      {/* eyes */}
      {mood === 'happy' ? (
        <>
          <path d="M38 56 Q45 48 52 56" fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M68 56 Q75 48 82 56" fill="none" stroke={ink} strokeWidth="3.6" strokeLinecap="round" />
        </>
      ) : (
        <g className="pc-blink">
          <g className={mood === 'search' ? 'pc-look' : ''}>
            <ellipse cx="45" cy="55" rx="6.5" ry="8" fill={ink} />
            <ellipse cx="75" cy="55" rx="6.5" ry="8" fill={ink} />
            <ellipse cx="45" cy="58" rx="4.2" ry="4" fill="#3a86ff" opacity=".9" />
            <ellipse cx="75" cy="58" rx="4.2" ry="4" fill="#3a86ff" opacity=".9" />
            <circle cx="42.8" cy="52" r="2.4" fill="#fff" />
            <circle cx="72.8" cy="52" r="2.4" fill="#fff" />
            <circle cx="47" cy="59" r="1.1" fill="#fff" />
            <circle cx="77" cy="59" r="1.1" fill="#fff" />
          </g>
        </g>
      )}

      {/* ninja mask over nose + mouth */}
      <path d="M31 66 Q60 61 89 66 Q90 80 60 83 Q30 80 31 66 Z" fill={ink} />
      <path d="M40 70 Q60 66 80 70" stroke="#2f3550" strokeWidth="2" fill="none" />
      {/* blush */}
      <ellipse cx="36" cy="63" rx="4.5" ry="2.5" fill="#ff8fa3" opacity=".55" />
      <ellipse cx="84" cy="63" rx="4.5" ry="2.5" fill="#ff8fa3" opacity=".55" />
      {/* scarf around neck */}
      <path d="M38 80 Q60 90 82 80 L82 88 Q60 97 38 88 Z" fill="#e63946" />
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
