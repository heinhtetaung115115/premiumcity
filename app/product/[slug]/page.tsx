import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProductBySlug } from '@/lib/catalog';
import { InsufficientFundsModal } from '@/components/InsufficientFundsModal';
import { PurchaseForm } from './PurchaseForm';

type ProductPageProps = {
  params: { slug: string };
  searchParams?: { error?: string };
};

function formatKS(amount: number) {
  return `${amount.toLocaleString()} Ks`;
}

function decodeError(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const product = await getProductBySlug(params.slug);

  if (!product || product.status !== 'ACTIVE') {
    notFound();
  }

  const errorCode = searchParams?.error || null;
  const showInsufficientModal = errorCode === 'INSUFFICIENT_FUNDS';
  const otherErrorMessage =
    errorCode && errorCode !== 'INSUFFICIENT_FUNDS'
      ? decodeError(errorCode)
      : null;

  const hasVariants = product.variants.length > 0;
  const primaryVariant = hasVariants ? product.variants[0] : null;

  const isInstant = product.productType === 'INSTANT';
  const isManual = product.productType === 'MANUAL';

  // outline-vpn stock is per country (admin switch + working server), not inventory.
  const isOutlineVpn = product.slug === 'outline-vpn';
  const canPurchase =
    hasVariants &&
    (isOutlineVpn ? product.isInStock : isManual || (isInstant && product.isInStock));

  const categorySlug = product.category?.slug ?? null;

  // Admin-controlled tags: array of { key, value }
  const tags: { key: string; value: string }[] = Array.isArray((product as any).tags)
    ? (product as any).tags.filter(
        (t: any) => t && typeof t.key === 'string' && typeof t.value === 'string' && t.key.trim() && t.value.trim()
      )
    : [];

  return (
    <main className="mx-auto max-w-2xl sm:py-2">
      {/* 🔔 Wallet insufficient funds modal */}
      <InsufficientFundsModal showOnMount={showInsufficientModal} />

      {/* Back link */}
      <div className="mb-4">
        <Link
          href={categorySlug ? `/category/${categorySlug}` : '/'}
          className="glass press inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-3.5 text-[13px] font-medium text-slate-200 hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </Link>
      </div>

      <div className="space-y-4">
        {/* ── HERO CARD (Design 1: photo top) ── */}
        <section className="glass overflow-hidden rounded-[28px] p-1.5">
          {/* Product photo */}
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[22px] bg-slate-800/40">
            {(product as any).imageUrl ? (
              <img
                src={(product as any).imageUrl}
                alt={product.name}
                className={`h-full w-full object-cover ${!product.isInStock && isInstant ? 'opacity-60 grayscale' : ''}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-emerald-500/[0.08] text-emerald-400">
                <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4}>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
                </svg>
              </div>
            )}
            {/* Delivery + stock badge overlaid */}
            <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur-md">
                {isInstant ? (
                  <svg className="h-3 w-3 text-emerald-300" viewBox="0 0 16 16"><path d="M8.5 1L3 9.5h4.5L7 15l6-8.5H8.5L9 1z" fill="currentColor" /></svg>
                ) : (
                  <svg className="h-3 w-3 text-emerald-300" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 7h6M5 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
                )}
                {isInstant ? 'Instant delivery' : 'Manual delivery'}
              </span>
              {(isInstant || isOutlineVpn) && (
                <span
                  className={`inline-flex items-center rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ring-white/15 backdrop-blur-md ${
                    product.isInStock ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {product.isInStock ? 'In stock' : 'Out of stock'}
                </span>
              )}
            </div>
          </div>

          {/* Info below photo */}
          <div className="px-4 pb-4 pt-4 sm:px-5">
            {product.category?.name && (
              <p className="text-[13px] font-medium text-slate-500">
                {product.category.name.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').trim()}
              </p>
            )}
            <h1 className="mt-0.5 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-white">{product.name}</h1>

            {/* Sold count — "Hot seller" animated flame */}
            <style
              dangerouslySetInnerHTML={{
                __html: `
@keyframes pcFireFlicker {
  0%, 100% { transform: scale(1) rotate(-2deg); opacity: 1; }
  50%      { transform: scale(1.15) rotate(2deg); opacity: 0.85; }
}
.pc-flame {
  display: inline-block;
  transform-origin: center bottom;
  animation: pcFireFlicker 0.8s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .pc-flame { animation: none; }
}
`,
              }}
            />
            <div className="mt-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/[0.12] px-3 py-1.5 ring-1 ring-inset ring-orange-400/25">
                <svg className="pc-flame h-4 w-4 text-orange-400" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 2c1 3.5 5 5.8 5 11a5 5 0 01-10 0c0-2.4 1.2-4 2.4-5.2.2 1.6 1 2.7 2.1 3.2-.4-3.2-.1-6.3.5-9z" />
                </svg>
                <span className="text-[13px] text-orange-200">
                  <span className="font-bold text-orange-400">
                    {((product as any).soldCount ?? 0).toLocaleString('en-US')}
                  </span>{' '}
                  sold
                </span>
              </span>
            </div>

            {/* ── Admin-controlled pill tags ── */}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] ring-1 ring-inset ring-white/10"
                  >
                    <span className="text-slate-500">{t.key}</span>
                    <span className="font-medium text-slate-200">{t.value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── Details ── */}
        {product.description && (
          <section className="glass rounded-[24px] px-5 py-4">
            <h2 className="mb-1.5 text-[15px] font-semibold tracking-[-0.01em] text-white">Details</h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-300">{String(product.description).trim()}</p>
          </section>
        )}

        {/* ── Delivery info ── */}
        {product.deliveryNote && (
          <section className="glass rounded-[24px] px-5 py-4">
            <h2 className="mb-1.5 text-[15px] font-semibold tracking-[-0.01em] text-white">Delivery info</h2>
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-300">{String(product.deliveryNote).trim()}</p>
          </section>
        )}

        {/* ── Purchase card (plan select + buy) ── */}
        <section className="glass rounded-[28px] px-4 py-5 sm:px-5">
          <PurchaseForm
            product={product}
            isManual={isManual}
            isInstant={isInstant}
            canPurchase={canPurchase}
            primaryVariant={primaryVariant}
            otherErrorMessage={otherErrorMessage}
          />
        </section>
      </div>
    </main>
  );
}
