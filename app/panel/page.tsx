export default function PanelHome() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-2xl ring-1 ring-white/10">🔐</div>
      <h1 className="text-xl font-semibold text-white">Account Panel</h1>
      <p className="mt-2 text-sm text-slate-400">
        သင့်ထံ ပို့ပေးထားသော Link ကို ဖွင့်ပါ။
        <span className="mt-1 block text-slate-500">Open the link you received to see your account.</span>
      </p>
    </main>
  );
}
