// components/preset-avatars.ts
// Pre-made avatars stored as inline SVG data URLs.
// These qualify as valid avatars (data:image/...) for the profile reward.

function svgToDataUrl(svg: string): string {
  // encodeURIComponent keeps it safe as a data URL
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

type Preset = { id: string; label: string; url: string };

// Each avatar: a colored gradient circle with a simple emoji/shape.
// Emerald-family palette to match the store theme, plus a few accents.
const AVATAR_DEFS: { id: string; label: string; bg: [string, string]; emoji: string }[] = [
  { id: 'fox', label: 'Fox', bg: ['#f59e0b', '#d97706'], emoji: '🦊' },
  { id: 'cat', label: 'Cat', bg: ['#10b981', '#059669'], emoji: '🐱' },
  { id: 'panda', label: 'Panda', bg: ['#64748b', '#334155'], emoji: '🐼' },
  { id: 'robot', label: 'Robot', bg: ['#0ea5e9', '#0284c7'], emoji: '🤖' },
  { id: 'alien', label: 'Alien', bg: ['#8b5cf6', '#7c3aed'], emoji: '👽' },
  { id: 'ninja', label: 'Ninja', bg: ['#1e293b', '#0f172a'], emoji: '🥷' },
  { id: 'dragon', label: 'Dragon', bg: ['#ef4444', '#dc2626'], emoji: '🐉' },
  { id: 'star', label: 'Star', bg: ['#eab308', '#ca8a04'], emoji: '⭐' },
  { id: 'rocket', label: 'Rocket', bg: ['#06b6d4', '#0891b2'], emoji: '🚀' },
  { id: 'crown', label: 'Crown', bg: ['#a855f7', '#9333ea'], emoji: '👑' },
  { id: 'lion', label: 'Lion', bg: ['#f97316', '#ea580c'], emoji: '🦁' },
  { id: 'ghost', label: 'Ghost', bg: ['#14b8a6', '#0d9488'], emoji: '👻' },
];

export const PRESET_AVATARS: Preset[] = AVATAR_DEFS.map((a) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/>
</linearGradient></defs>
<rect width="256" height="256" fill="url(#g)"/>
<text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="140">${a.emoji}</text>
</svg>`;
  return { id: a.id, label: a.label, url: svgToDataUrl(svg) };
});
