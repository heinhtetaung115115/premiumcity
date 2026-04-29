// app/product/[slug]/loading.tsx

export default function ProductPageLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Left: “card” / info block */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 rounded-full bg-slate-800 animate-pulse" />
              <div className="h-3 w-1/3 rounded-full bg-slate-900/80 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-900 animate-pulse" />
            <div className="h-3 w-5/6 rounded-full bg-slate-900 animate-pulse" />
            <div className="h-3 w-2/3 rounded-full bg-slate-900 animate-pulse" />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="h-9 rounded-xl bg-slate-900/80 animate-pulse" />
            <div className="h-9 rounded-xl bg-slate-900/80 animate-pulse" />
          </div>
        </div>

        {/* Right: price + purchase area */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 shadow-sm">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded-full bg-slate-800 animate-pulse" />
            <div className="h-6 w-32 rounded-full bg-slate-900 animate-pulse" />
          </div>

          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-900/80 animate-pulse" />
            <div className="h-3 w-4/5 rounded-full bg-slate-900/80 animate-pulse" />
          </div>

          <div className="pt-2 space-y-3">
            <div className="h-9 w-full rounded-xl bg-emerald-600/70 animate-pulse" />
            <div className="h-4 w-32 rounded-full bg-slate-900/80 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
