'use client';

import { useId } from 'react';

/**
 * City Bot — PremiumCity's mascot.
 * Poses: hello (waves), scan (checks a slip), done (cheers), oops (error).
 * Animations live in app/globals.css (classes starting with "cb-").
 */
export type CityBotPose = 'hello' | 'scan' | 'done' | 'oops';

const C = {
  body: ['#a7f3d0', '#34d399', '#047857'],
  head: ['#d1fae5', '#4ade80', '#059669'],
};

export default function CityBot({
  pose = 'hello',
  size = 200,
  className = '',
  label,
}: {
  pose?: CityBotPose;
  size?: number;
  className?: string;
  label?: string;
}) {
  const s = useId().replace(/[^a-zA-Z0-9]/g, '');
  const u = (n: string) => `url(#${n}${s})`;

  const floatCls = pose === 'done' ? 'cb-jump' : pose === 'oops' ? 'cb-float-slow' : 'cb-float';
  const headCls = pose === 'oops' ? 'cb-droop' : pose === 'scan' ? 'cb-tilt-small' : 'cb-tilt';

  const arm = (side: 'L' | 'R', cls: string, angle: number) => {
    const x = side === 'L' ? 66 : 134;
    const sx = side === 'L' ? -1 : 1;
    return (
      <g className={cls} style={{ transformOrigin: `${x}px 140px` }}>
        <g transform={`rotate(${angle} ${x} 140)`}>
          <rect x={x - 7} y={136} width={14} height={34} rx={7} fill={u('bd')} transform={`rotate(${sx * -28} ${x} 140)`} />
          <circle cx={x + sx * 16} cy={168} r={8} fill={u('mt')} />
        </g>
      </g>
    );
  };

  const arms =
    pose === 'hello' ? (
      <>{arm('L', 'cb-swing', 0)}{arm('R', 'cb-wave', -110)}</>
    ) : pose === 'scan' ? (
      <>{arm('L', 'cb-swing', 10)}{arm('R', 'cb-swing', 0)}</>
    ) : pose === 'done' ? (
      <>{arm('L', 'cb-cheer', 100)}{arm('R', 'cb-cheer', -100)}</>
    ) : (
      <>{arm('L', '', -10)}{arm('R', '', 10)}</>
    );

  const blinkEye = (cx: number) => (
    <g className="cb-blink" style={{ transformOrigin: `${cx}px 86px` }}>
      <rect x={cx - 7} y={76} width={14} height={20} rx={7} fill="#67e8f9" filter={u('gl')} />
      <rect x={cx - 6} y={77} width={12} height={18} rx={6} fill="#a5f3fc" />
    </g>
  );

  const eyes =
    pose === 'hello' ? (
      <g className="cb-look">{blinkEye(85)}{blinkEye(115)}</g>
    ) : pose === 'scan' ? (
      <><rect x={76} y={84} width={18} height={6} rx={3} fill="#a5f3fc" />{blinkEye(115)}</>
    ) : pose === 'done' ? (
      <>
        <path d="M77 90 Q85 78 93 90" stroke="#a5f3fc" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M107 90 Q115 78 123 90" stroke="#a5f3fc" strokeWidth={5} fill="none" strokeLinecap="round" />
      </>
    ) : (
      <>
        <path d="M77 82 Q85 92 93 86" stroke="#a5f3fc" strokeWidth={5} fill="none" strokeLinecap="round" />
        <path d="M107 86 Q115 92 123 82" stroke="#a5f3fc" strokeWidth={5} fill="none" strokeLinecap="round" />
      </>
    );

  const mouth =
    pose === 'hello' ? <path d="M92 103 Q100 109 108 103" stroke="#a5f3fc" strokeWidth={3.5} fill="none" strokeLinecap="round" />
    : pose === 'scan' ? <path d="M94 105 L106 105" stroke="#a5f3fc" strokeWidth={3.5} strokeLinecap="round" />
    : pose === 'done' ? <path d="M90 100 Q100 112 110 100 Z" fill="#a5f3fc" />
    : <path d="M92 107 Q100 101 108 107" stroke="#a5f3fc" strokeWidth={3.5} fill="none" strokeLinecap="round" />;

  return (
    <svg
      className={className}
      width={size}
      height={(size * 240) / 200}
      viewBox="0 0 200 240"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <radialGradient id={`bd${s}`} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor={C.body[0]} /><stop offset="0.45" stopColor={C.body[1]} /><stop offset="1" stopColor={C.body[2]} />
        </radialGradient>
        <radialGradient id={`hd${s}`} cx="32%" cy="22%" r="85%">
          <stop offset="0" stopColor={C.head[0]} /><stop offset="0.4" stopColor={C.head[1]} /><stop offset="1" stopColor={C.head[2]} />
        </radialGradient>
        <linearGradient id={`vz${s}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3a5f" /><stop offset="1" stopColor="#050b18" />
        </linearGradient>
        <radialGradient id={`mt${s}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" /><stop offset="0.5" stopColor="#cbd5e1" /><stop offset="1" stopColor="#64748b" />
        </radialGradient>
        <radialGradient id={`gd${s}`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff7cc" /><stop offset="0.45" stopColor="#fbbf24" /><stop offset="1" stopColor="#b45309" />
        </radialGradient>
        <linearGradient id={`fl${s}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef08a" /><stop offset="0.5" stopColor="#fb923c" /><stop offset="1" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`bm${s}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#67e8f9" stopOpacity="0.75" /><stop offset="1" stopColor="#67e8f9" stopOpacity="0" />
        </linearGradient>
        <filter id={`gl${s}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>

      <ellipse className="cb-shadow" cx={100} cy={228} rx={46} ry={7} fill="#000" opacity={0.45} style={{ transformOrigin: '100px 228px' }} />

      {pose === 'scan' && (
        <>
          <g className="cb-beam" style={{ transformOrigin: '100px 92px' }}>
            <path d="M92 96 L40 196 L96 196 Z" fill={u('bm')} />
          </g>
          <g transform="rotate(-8 50 190)">
            <rect x={28} y={168} width={40} height={52} rx={5} fill="#f8fafc" />
            <rect x={28} y={168} width={40} height={9} rx={4} fill="#0b5cad" />
            <rect x={35} y={183} width={26} height={3} rx={1.5} fill="#94a3b8" />
            <rect x={35} y={190} width={20} height={3} rx={1.5} fill="#cbd5e1" />
            <rect x={40} y={198} width={16} height={16} rx={2} fill="#0f172a" />
          </g>
        </>
      )}

      <g className={floatCls} style={pose === 'done' ? { transformOrigin: '100px 198px' } : undefined}>
        {pose !== 'oops' && (
          <>
            <g className="cb-flame" style={{ transformOrigin: '88px 196px' }}>
              <path d="M82 196 Q88 222 94 196 Z" fill={u('fl')} />
            </g>
            <g className="cb-flame" style={{ transformOrigin: '112px 196px', animationDelay: '.12s' }}>
              <path d="M106 196 Q112 222 118 196 Z" fill={u('fl')} />
            </g>
          </>
        )}
        <rect x={80} y={188} width={16} height={10} rx={4} fill={u('mt')} />
        <rect x={104} y={188} width={16} height={10} rx={4} fill={u('mt')} />
        {arms}
        <rect x={64} y={126} width={72} height={68} rx={30} fill={u('bd')} />
        <ellipse cx={84} cy={140} rx={12} ry={6} fill="#ffffff" opacity={0.35} />

        {/* PremiumCity nameplate */}
        <g className="cb-core">
          <rect x={74} y={146} width={52} height={33} rx={10} fill="#fbbf24" opacity={0.55} filter={u('gl')} />
        </g>
        <rect x={74} y={146} width={52} height={33} rx={10} fill="#0b1324" stroke={u('gd')} strokeWidth={2} />
        <path d="M80 150 Q100 146 120 150" stroke="#ffffff" strokeWidth={1.6} fill="none" opacity={0.25} strokeLinecap="round" />
        <text x={100} y={159.5} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize={6.6} fontWeight={700} letterSpacing={1.6} fill="#fde68a">PREMIUM</text>
        <text x={100} y={173.5} textAnchor="middle" fontFamily="Inter, system-ui, sans-serif" fontSize={13} fontWeight={800} letterSpacing={1} fill={u('gd')}>CITY</text>

        <g className={headCls} style={{ transformOrigin: '100px 128px' }}>
          <g className={pose === 'oops' ? 'cb-ant-droop' : 'cb-ant'} style={{ transformOrigin: '100px 48px' }}>
            <rect x={98} y={24} width={4} height={26} rx={2} fill={u('mt')} />
            <circle className="cb-bulb" cx={100} cy={22} r={8} fill={u('gd')} />
            <circle cx={97} cy={19} r={2.4} fill="#fff" />
          </g>
          <circle cx={50} cy={88} r={13} fill={u('mt')} />
          <circle cx={150} cy={88} r={13} fill={u('mt')} />
          <circle cx={50} cy={88} r={5} fill="#fbbf24" />
          <circle cx={150} cy={88} r={5} fill="#fbbf24" />
          <rect x={52} y={46} width={96} height={84} rx={34} fill={u('hd')} />
          <ellipse cx={74} cy={58} rx={16} ry={7} fill="#ffffff" opacity={0.45} transform="rotate(-18 74 58)" />
          <rect x={62} y={62} width={76} height={54} rx={22} fill={u('vz')} />
          <path d="M70 70 Q90 62 120 66" stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.22} />
          {eyes}
          {mouth}
          <ellipse cx={72} cy={104} rx={5} ry={3} fill="#f472b6" opacity={0.65} />
          <ellipse cx={128} cy={104} rx={5} ry={3} fill="#f472b6" opacity={0.65} />
        </g>
      </g>

      {pose === 'done' && (
        <>
          <g className="cb-conf">
            <rect x={30} y={30} width={7} height={12} rx={2} fill="#f472b6" />
            <rect x={160} y={40} width={7} height={12} rx={2} fill="#60a5fa" />
            <rect x={150} y={16} width={6} height={10} rx={2} fill="#fbbf24" />
            <rect x={48} y={10} width={6} height={10} rx={2} fill="#34d399" />
          </g>
          <g className="cb-coin">
            <circle cx={36} cy={120} r={10} fill="#fbbf24" stroke="#b45309" strokeWidth={2.5} />
            <text x={36} y={124} textAnchor="middle" fontSize={9} fontWeight={700} fill="#78350f" fontFamily="Inter, sans-serif">Ks</text>
          </g>
          <g className="cb-coin" style={{ animationDelay: '.5s' }}>
            <circle cx={166} cy={110} r={8} fill="#fcd34d" stroke="#b45309" strokeWidth={2.5} />
          </g>
        </>
      )}
      {pose === 'oops' && (
        <g className="cb-drop">
          <path d="M150 52 Q156 62 150 66 Q144 62 150 52 Z" fill="#7dd3fc" />
        </g>
      )}
    </svg>
  );
}
