// app/vpn/[code]/page.tsx
// Public VPN status page (no login): share this link with website buyers and
// Viber/Telegram customers. Shows the key, usage, expiry and the
// "request new key" button. Stops showing the key once the plan expires.

import type { Metadata } from 'next';
import { getStatusView } from '@/lib/vpn';
import { VpnStatusClient } from './VpnStatusClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'VPN Key · PremiumCity',
  robots: { index: false, follow: false },
};

export default async function VpnStatusPage({ params }: { params: { code: string } }) {
  const view = await getStatusView(params.code);

  if (!view || !view.active) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-3xl">
          🔒
        </div>
        <h1 className="text-xl font-semibold text-slate-100">
          {view ? 'This VPN plan has expired' : 'Link not found'}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {view
            ? 'ဤ VPN သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ သက်တမ်းတိုးရန် PremiumCity သို့ ဆက်သွယ်ပါ။'
            : 'Please check the link or contact PremiumCity.'}
        </p>
      </div>
    );
  }

  return <VpnStatusClient view={view} />;
}
