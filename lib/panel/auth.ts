// lib/panel/auth.ts
// Separate admin login for the account panel: one password (env
// PANEL_ADMIN_PASSWORD) and an HMAC-signed cookie. Not shared with the
// PremiumCity admin login on purpose.

import crypto from 'crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const PANEL_COOKIE = 'pc_panel_admin';
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

function secret(): string {
  return process.env.PANEL_SESSION_SECRET || process.env.NEXTAUTH_SECRET || '';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionValue(): string {
  const payload = `v1.${Date.now() + MAX_AGE_SEC * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(value: string | undefined | null): boolean {
  if (!value || !secret()) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const a = Buffer.from(parts[2]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(parts[1]) > Date.now();
}

export function checkPassword(input: string): boolean {
  // Trim both: a space/newline pasted into Vercel's env field is invisible.
  const real = (process.env.PANEL_ADMIN_PASSWORD || '').trim();
  input = String(input || '').trim();
  if (!real || !input) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}

/** '' on pcity.online (paths are rewritten), '/panel' when opened directly (previews). */
export function panelBase(): string {
  return headers().get('x-pc-panel-host') === '1' ? '' : '/panel';
}

export function isPanelAdmin(): boolean {
  return isValidSession(cookies().get(PANEL_COOKIE)?.value);
}

export function requirePanelAdmin(): void {
  if (!isPanelAdmin()) redirect(`${panelBase()}/admin/login`);
}
