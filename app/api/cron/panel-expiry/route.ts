// Hourly: remind admin about account-panel customers expiring today until
// each one is marked "Job done".
import { NextResponse } from 'next/server';
import { dueExpiryJobs, sendExpiryReminder } from '@/lib/panel/expiry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  const provided = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (secret && provided !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const jobs = await dueExpiryJobs();
    if (jobs.length) await sendExpiryReminder(jobs);
    return NextResponse.json({ ok: true, due: jobs.length });
  } catch (e: any) {
    console.error('[cron/panel-expiry]', e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
