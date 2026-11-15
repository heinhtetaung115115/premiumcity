import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { registerSlip } from '@/lib/usedSlips';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  const session: any = await getServerSession(authConfig);
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Admin login required.' }, { status: 401 });
  }
  try {
    const fd = await req.formData();
    const res = await registerSlip(fd);
    return NextResponse.json(res);
  } catch (e: any) {
    console.error('[admin/slips] failed:', e);
    return NextResponse.json({ ok: false, error: `Failed: ${e?.message ?? e}` }, { status: 500 });
  }
}
