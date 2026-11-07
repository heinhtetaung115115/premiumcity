// middleware.ts
// The account panel lives in this same app under /panel, but is served on its
// own domain (pcity.online). On that domain we rewrite:
//   /            -> /panel
//   /admin...    -> /panel/admin...
//   /c/<token>   -> /panel/c/<token>
//   /api/c/<t>   -> /api/panel/c/<t>   (supplier-compatible JSON)
// and nothing from the PremiumCity store is reachable there. On the store
// domain the panel is hidden in production.

import { NextResponse, type NextRequest } from 'next/server';

const PANEL_HOSTS = (process.env.PANEL_HOSTS || 'pcity.online,www.pcity.online')
  .split(',')
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') || '').split(':')[0].toLowerCase();
  const { pathname } = req.nextUrl;

  if (PANEL_HOSTS.includes(host)) {
    // Static files (icons, images) pass through.
    if (/\.[a-z0-9]{2,5}$/i.test(pathname) && !pathname.startsWith('/api/')) return NextResponse.next();

    let target: string;
    if (pathname.startsWith('/api/panel/')) target = pathname;
    else if (pathname.startsWith('/api/c/')) target = `/api/panel/c/${pathname.slice('/api/c/'.length)}`;
    else if (pathname === '/') target = '/panel';
    else if (pathname.startsWith('/admin') || pathname.startsWith('/c/')) target = `/panel${pathname}`;
    else target = '/panel/missing';

    const url = req.nextUrl.clone();
    url.pathname = target;
    const headers = new Headers(req.headers);
    headers.set('x-pc-panel', '1');
    headers.set('x-pc-panel-host', '1');
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (pathname.startsWith('/panel') || pathname.startsWith('/api/panel')) {
    // Keep the panel off pcitystore.com in production (previews can test it).
    if (process.env.VERCEL_ENV === 'production') {
      return new NextResponse('Not found', { status: 404 });
    }
    const headers = new Headers(req.headers);
    headers.set('x-pc-panel', '1');
    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
