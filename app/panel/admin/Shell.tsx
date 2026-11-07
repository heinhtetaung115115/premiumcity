import Link from 'next/link';
import { logoutAction } from './actions';

export function Shell({ base, active, children }: { base: string; active: 'accounts' | 'inbox'; children: React.ReactNode }) {
  const tab = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${on ? 'bg-white/10 font-semibold text-white' : 'text-slate-400 hover:text-white'}`;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-200">🔐</span>
          <div>
            <p className="text-sm font-semibold text-white">Account Panel</p>
            <p className="text-[11px] text-slate-500">Admin</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          <Link href={`${base}/admin`} className={tab(active === 'accounts')}>
            Accounts
          </Link>
          <Link href={`${base}/admin/inbox`} className={tab(active === 'inbox')}>
            Inbox
          </Link>
          <form action={logoutAction}>
            <button className="ml-2 rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-rose-300">Log out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}

export const inputCls =
  'w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400/70';
export const labelCls = 'mb-1 block text-[11px] uppercase tracking-wider text-slate-500';
export const cardCls = 'rounded-2xl border border-white/10 bg-white/[0.03] p-4';
export const btnCls = 'rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-400';
