import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { getServiceSupabaseClient } from '@/lib/supabase';
import { deleteSlipAction } from './actions';
import SlipForm from './SlipForm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AdminSlipsPage({ searchParams }: { searchParams?: { q?: string } }) {
  await requireAdmin();
  const supabase = getServiceSupabaseClient();
  const q = String(searchParams?.q ?? '').trim();

  // Saved slips are only shown when searching.
  const { error: tableErr } = await supabase.from('used_slips').select('id').limit(1);
  const tableMissing = !!tableErr && /does not exist/i.test(tableErr.message);

  let rows: any[] = [];
  if (q && !tableMissing) {
    let query = supabase
      .from('used_slips')
      .select('id,transaction_id,tid_digits,amount,sender_name,slip_time,note,read_by,created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    const qDigits = q.replace(/\D/g, '');
    if (qDigits.length >= 4) query = query.ilike('tid_digits', `%${qDigits}%`);
    else query = query.ilike('note', `%${q}%`);
    const { data } = await query;
    rows = (data ?? []) as any[];
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
          ← Admin
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Used slips (Viber / Telegram)</h1>
        <p className="text-xs text-slate-400">
          When a customer pays you directly, save their KBZPay slip here. That slip can then never be used for a website
          top-up. It also tells you if the slip was already used on the website.
        </p>
      </div>

      {tableMissing && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Run <code>supabase/migrations/0008_used_slips.sql</code> in the Supabase SQL editor first.
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <SlipForm />
      </section>

      <section className="space-y-2">
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search Transaction No. or note"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          />
          <button className="rounded-lg border border-slate-700 px-3 text-sm text-slate-200 hover:border-emerald-400">Search</button>
        </form>

        {!q ? (
          <p className="py-4 text-center text-xs text-slate-500">Search a Transaction No. (or part of it) or a note to check a saved slip.</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">Not saved — no slip matches “{q}”.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="min-w-0 text-xs">
                <p className="break-all font-mono text-sm text-slate-100">{r.transaction_id}</p>
                <p className="mt-0.5 text-slate-400">
                  {r.amount ? `${Number(r.amount).toLocaleString()} Ks · ` : ''}
                  {r.sender_name ? `${r.sender_name} · ` : ''}
                  {r.slip_time ? `${r.slip_time} · ` : ''}
                  read by {r.read_by}
                </p>
                {r.note && <p className="mt-0.5 text-slate-300">{r.note}</p>}
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Saved {new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Yangon' })}
                </p>
              </div>
              <form action={deleteSlipAction}>
                <input type="hidden" name="id" value={r.id} />
                <button className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:border-rose-400 hover:text-rose-300">
                  Remove
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
