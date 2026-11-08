// Customer page: account details + login codes while the warranty is active.
import { getLinkByToken, linkIsLive, touchLink } from '@/lib/panel/data';
import { serviceInfo } from '@/lib/panel/rules';
import { CustomerPanel } from './CustomerPanel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CustomerLinkPage({ params }: { params: { token: string } }) {
  const found = await getLinkByToken(params.token);

  if (!found || !linkIsLive(found.link) || found.account.status !== 'active') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">⏳</div>
        <h1 className="text-xl font-semibold text-white">{found ? 'This link has expired' : 'Link not found'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {found
            ? 'Warranty သက်တမ်း ကုန်ဆုံးသွားပါပြီ။ သက်တမ်းတိုးရန် ဆိုင်သို့ ဆက်သွယ်ပါ။'
            : 'Link မှန်ကန်မှု ရှိမရှိ စစ်ဆေးပါ။'}
        </p>
      </main>
    );
  }

  await touchLink(found.link.id);
  const { link, account } = found;
  const svc = serviceInfo(account.service);

  return (
    <CustomerPanel
      token={link.token}
      serviceName={svc.name}
      serviceColor={svc.color}
      email={account.email}
      password={account.password}
      profile={account.profile}
      pin={account.pin}
      warrantyUntil={link.warranty_until}
      createdAt={link.created_at}
      passwordUpdatedAt={account.password_updated_at}
      customerName={link.customer_name}
      theme={account.service === 'crunchyroll' ? 'anime' : null}
    />
  );
}
