// lib/panel/config.ts
// Account panel served on its own domain (pcity.online). Same codebase and
// database as PremiumCity, but a separate site with its own admin login.

export const PANEL_HOSTS = (process.env.PANEL_HOSTS || 'pcity.online,www.pcity.online')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function panelPublicUrl(): string {
  return (process.env.PANEL_PUBLIC_URL || 'https://pcity.online').replace(/\/+$/, '');
}

export function customerLinkUrl(token: string): string {
  return `${panelPublicUrl()}/c/${token}`;
}

/** How far back "Get code" looks. Login codes expire within ~15 minutes. */
export const CODE_WINDOW_MINUTES = 30;
