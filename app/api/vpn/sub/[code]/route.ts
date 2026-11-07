// app/api/vpn/sub/[code]/route.ts
// Subscription link for Hiddify, V2Box, v2rayNG, Shadowrocket…
// Body: base64 of the current ss:// key(s), one per line.
// Headers let Hiddify show data used / total / days left and auto-update.
// Spec: https://github.com/hiddify/hiddify-app/wiki (URL Scheme → headers)

import { NextResponse } from 'next/server';
import { getSubscriptionFeed } from '@/lib/vpn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');

async function build(code: string, withBody: boolean) {
  const feed = await getSubscriptionFeed(code);
  if (!feed) return new NextResponse(withBody ? '' : null, { status: 404 });

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'profile-title': `base64:${b64('PremiumCity VPN')}`,
    'content-disposition': 'attachment; filename="PremiumCity VPN"',
    'profile-update-interval': '1', // hours
    'subscription-userinfo': `upload=0; download=${feed.usedBytes}; total=${feed.totalBytes}; expire=${feed.expireUnix}`,
    'profile-web-page-url': feed.statusUrl,
    'support-url': feed.statusUrl,
  };

  const body = withBody ? b64(feed.ssUris.join('\n')) : null;
  return new NextResponse(body, { status: 200, headers });
}

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  return build(params.code, true);
}

// Hiddify reads usage with HEAD requests while the app is open.
export async function HEAD(_req: Request, { params }: { params: { code: string } }) {
  return build(params.code, false);
}
