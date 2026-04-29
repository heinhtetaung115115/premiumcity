// app/category/[slug]/loading.tsx

export default function CategoryPageLoading() {
  const cards = Array.from({ length: 6 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Category header skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-24 rounded-full bg-slate-800 animate-pulse" />
        <div className="h-7 w-48 rounded-full bg-slate-900 animate-pulse" />
        <div className="h-3 w-64 rounded-full bg-slate-900/80 animate-pulse" />
      </div>

      {/* Product cards grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm"
          >
            {/* Top icon / badge */}
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="h-8 w-8 rounded-xl bg-slate-900 animate-pulse" />
              <div className="h-5 w-14 rounded-full bg-slate-900/80 animate-pulse" />
            </div>

            {/* Title */}
            <div className="mb-2 h-4 w-3/4 rounded-full bg-slate-800 animate-pulse" />

            {/* Description */}
            <div className="mb-3 space-y-1.5">
              <div className="h-3 w-full rounded-full bg-slate-900 animate-pulse" />
              <div className="h-3 w-5/6 rounded-full bg-slate-900 animate-pulse" />
            </div>

            {/* Price + button row */}
            <div className="mt-auto flex items-center justify-between gap-3 pt-2">
              <div className="h-4 w-20 rounded-full bg-slate-800 animate-pulse" />
              <div className="h-9 w-24 rounded-full bg-emerald-600/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
