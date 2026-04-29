// app/loading.tsx

export default function HomeLoading() {
  const cards = Array.from({ length: 6 });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-6 w-32 rounded-full bg-slate-800 animate-pulse" />
        <div className="h-8 w-24 rounded-full bg-slate-900/80 border border-slate-800 animate-pulse" />
      </div>

      {/* Category cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4 shadow-sm"
          >
            {/* Icon + badge row */}
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="h-9 w-9 rounded-xl bg-slate-900 animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-slate-900/80 animate-pulse" />
            </div>

            {/* Title */}
            <div className="mb-2 h-4 w-3/4 rounded-full bg-slate-800 animate-pulse" />

            {/* Description lines */}
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded-full bg-slate-900 animate-pulse" />
              <div className="h-3 w-5/6 rounded-full bg-slate-900 animate-pulse" />
            </div>

            {/* Footer row – “view products / count” */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="h-3 w-20 rounded-full bg-slate-800 animate-pulse" />
              <div className="h-7 w-20 rounded-full bg-slate-900/80 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
