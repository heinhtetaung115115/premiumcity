import { redirect } from 'next/navigation';
import { isPanelAdmin, panelBase } from '@/lib/panel/auth';
import { loginAction } from '../actions';

export const dynamic = 'force-dynamic';

export default function PanelLogin({ searchParams }: { searchParams?: { e?: string } }) {
  if (isPanelAdmin()) redirect(`${panelBase()}/admin`);
  const configured = !!process.env.PANEL_ADMIN_PASSWORD;
  const err = searchParams?.e;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 text-xl">🔐</div>
        <h1 className="text-lg font-semibold text-white">Admin login</h1>
        <p className="mb-5 text-xs text-slate-500">Account Panel</p>
        {!configured && (
          <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-200">
            Set PANEL_ADMIN_PASSWORD in Vercel environment variables first.
          </p>
        )}
        <form action={loginAction} className="space-y-3">
          <input
            name="password"
            type="password"
            placeholder="Password"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400/70"
          />
          <button className="w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white hover:bg-indigo-400">Log in</button>
        </form>
        {err && (
          <p className="mt-3 text-xs text-rose-300">
            {err === 'limit' ? 'Too many tries. Wait 15 minutes.' : 'Wrong password.'}
          </p>
        )}
      </div>
    </main>
  );
}
