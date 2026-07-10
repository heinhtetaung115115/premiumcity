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
  return `${amount.toLocaleString()} KS`;
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

  const canPurchase =
    hasVariants &&
    (isManual || (isInstant && product.isInStock));

  const categorySlug = product.category?.slug ?? null;

  // Admin-controlled tags: array of { key, value }
  const tags: { key: string; value: string }[] = Array.isArray((product as any).tags)
    ? (product as any).tags.filter(
        (t: any) => t && typeof t.key === 'string' && typeof t.value === 'string' && t.key.trim() && t.value.trim()
      )
    : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      {/* 🔔 Wallet insufficient funds modal */}
      <InsufficientFundsModal showOnMount={showInsufficientModal} />

      {/* Back link */}
      <div className="mb-4">
        <Link
          href={categorySlug ? `/category/${categorySlug}` : '/'}
          className="inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200"
        >
          ← Back
        </Link>
      </div>

      <div className="space-y-4">
        {/* ── HERO CARD (Design 1: photo top) ── */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
          {/* Product photo */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-800/40">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-emerald-300 backdrop-blur-sm">
                {isInstant ? '⚡ Instant' : '📦 Manual'}
              </span>
              {isInstant && (
                <span
                  className={`inline-flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm ${
                    product.isInStock ? 'text-emerald-300' : 'text-red-300'
                  }`}
                >
                  {product.isInStock ? 'In stock' : 'Out of stock'}
                </span>
              )}
            </div>
          </div>

          {/* Info below photo */}
          <div className="p-5">
            {product.category?.name && (
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {product.category.name}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-semibold text-slate-50">{product.name}</h1>

            {/* Sold count */}
            <div className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-400">
              <svg className="h-3.5 w-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <span className="font-semibold text-slate-200">
                  {((product as any).soldCount ?? 0).toLocaleString('en-US')}
                </span>{' '}
                sold
              </span>
            </div>

            {/* ── Admin-controlled pill tags ── */}
            {tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((t, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px]"
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
          <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4">
            <h2 className="mb-1.5 text-sm font-semibold text-slate-100">Details</h2>
            <p className="text-sm leading-relaxed text-slate-300">{product.description}</p>
          </section>
        )}

        {/* ── Delivery info ── */}
        {product.deliveryNote && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-4">
            <h2 className="mb-1.5 text-sm font-semibold text-slate-100">Delivery info</h2>
            <p className="text-sm text-slate-300">{product.deliveryNote}</p>
          </section>
        )}

        {/* ── Purchase card (plan select + buy) ── */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950 px-5 py-5 shadow-lg shadow-black/40">
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
