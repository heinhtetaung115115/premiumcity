// app/api/vpn/conf/[code]/route.ts
// Dynamic access key endpoint for the Outline app.
// Customers add  ssconf://<site>/api/vpn/conf/<code>  to Outline; the app
// fetches this JSON on every connect, so server swaps need no new key.
// Format: https://developers.google.com/outline/docs/guides/service-providers/dynamic-access-keys

import { NextResponse } from 'next/server';
import { getDynamicConfig } from '@/lib/vpn';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const result = await getDynamicConfig(params.code);
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
  if (result.error || !result.config) {
    // Outline shows error.message to the user inside the app.
    return new NextResponse(JSON.stringify({ error: { message: result.error || 'Key not available.' } }), { status: 200, headers });
  }
  return new NextResponse(JSON.stringify(result.config), { status: 200, headers });
}
