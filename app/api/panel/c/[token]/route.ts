// GET pcity.online/api/c/<token>
// Same JSON shape as the Netflix supplier panels, so PremiumCity's existing
// "supplier link" delivery (lib/netflix.ts) can read our own links too.
import { NextResponse } from 'next/server';
import { getLinkByToken, linkIsLive, recentAllowedEmails } from '@/lib/panel/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const found = await getLinkByToken(params.token);
  if (!found || !linkIsLive(found.link) || found.account.status !== 'active') {
    return NextResponse.json({ success: false, error: 'This link is invalid or has expired.' }, { status: 404 });
  }
  const { account, link } = found;
  const mails = await recentAllowedEmails(account.id);
  return NextResponse.json(
    {
      success: true,
      data: {
        profile: {
          email: account.email,
          password: account.password,
          name: link.profile_name ?? account.profile,
          pin: link.profile_pin ?? account.pin,
          endDate: link.warranty_until,
        },
        messages: mails.map((m) => ({
          subject: m.subject,
          from: m.from_address,
          code: m.code,
          text: m.text_body,
          html: m.action_link ? `<a href="${m.action_link.replace(/"/g, "&quot;")}">Verify</a>` : '',
          date: m.received_at,
        })),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
