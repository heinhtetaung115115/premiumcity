// lib/panel/expiry.ts
// "Customer expired today" jobs: the admin removes the profile / changes the
// password, then presses Job done. Until then the alert repeats every hour.

import { getServiceSupabaseClient } from '@/lib/supabase';
import { sendTelegramMessage } from '@/lib/telegram';

export type ExpiryJob = {
  id: string;
  token: string;
  account_id: string;
  customer_name: string | null;
  profile_name: string | null;
  warranty_until: string;
  accountEmail: string;
  service: string;
};

/** End of today in Myanmar time (UTC+06:30). */
export function endOfTodayYangon(): Date {
  const offset = 6.5 * 3600_000;
  const local = new Date(Date.now() + offset);
  local.setUTCHours(23, 59, 59, 999);
  return new Date(local.getTime() - offset);
}

/** Active links that expire today (or already expired) and aren't handled yet. */
export async function dueExpiryJobs(): Promise<ExpiryJob[]> {
  const db = getServiceSupabaseClient();
  const { data, error } = await db
    .from('panel_links')
    .select('id,token,account_id,customer_name,profile_name,warranty_until,status,expiry_handled_at')
    .eq('status', 'active')
    .is('expiry_handled_at', null)
    .order('warranty_until', { ascending: true })
    .limit(2000);
  if (error) throw error;
  const cutoff = endOfTodayYangon().getTime();
  const rows = ((data ?? []) as any[]).filter((r) => new Date(r.warranty_until).getTime() <= cutoff);
  if (!rows.length) return [];
  const ids = Array.from(new Set(rows.map((r) => r.account_id)));
  const { data: accs } = await db.from('panel_accounts').select('id,email,service').in('id', ids);
  const byId: Record<string, any> = {};
  for (const a of (accs ?? []) as any[]) byId[a.id] = a;
  return rows
    .filter((r) => byId[r.account_id])
    .map((r) => ({ ...r, accountEmail: byId[r.account_id].email, service: byId[r.account_id].service }));
}

export async function markExpiryHandled(idOrAll: string): Promise<number> {
  const db = getServiceSupabaseClient();
  const ids = idOrAll === 'all' ? (await dueExpiryJobs()).map((j) => j.id) : [idOrAll];
  for (const id of ids) {
    await db.from('panel_links').update({ expiry_handled_at: new Date().toISOString() }).eq('id', id);
  }
  return ids.length;
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** One grouped Telegram reminder with a Job done button per customer. */
export async function sendExpiryReminder(jobs: ExpiryJob[]): Promise<boolean> {
  if (!jobs.length) return false;
  const shown = jobs.slice(0, 10);
  const lines = shown.map((j) => {
    const ended = new Date(j.warranty_until).getTime() <= Date.now();
    const when = new Date(j.warranty_until).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Yangon',
    });
    return `• <b>${esc(j.profile_name || 'Profile')}</b> (${esc(j.customer_name || 'customer')}) on ${esc(j.accountEmail)} — ${
      ended ? 'ended' : 'ends'
    } ${when}`;
  });
  const text = [
    `⏰ <b>Customer expiry — action needed (${jobs.length})</b>`,
    '',
    ...lines,
    jobs.length > shown.length ? `…and ${jobs.length - shown.length} more` : '',
    '',
    'Remove the profile (or change the password), then press Job done. I will remind you every hour until then.',
  ]
    .filter((l) => l !== '')
    .join('\n');
  const buttons = shown.map((j) => [
    { text: `✅ Job done: ${(j.profile_name || 'profile').slice(0, 20)} · ${j.accountEmail.split('@')[0].slice(0, 14)}`, callback_data: `pjd:${j.id}` },
  ]);
  if (jobs.length > 1) buttons.push([{ text: `✅ All ${jobs.length} done`, callback_data: 'pjd:all' }]);
  buttons.push([{ text: '🔗 Account panel', url: 'https://pcity.online/admin' } as any]);
  return sendTelegramMessage({ text, buttons: buttons as any });
}
