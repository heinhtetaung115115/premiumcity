// components/Footer.tsx
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/90">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-[11px] text-slate-500">
          © {new Date().getFullYear()} PremiumCity. All rights reserved.
        </p>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <Link
            href="/terms"
            className="text-slate-400 hover:text-emerald-300"
          >
            Terms &amp; Conditions
          </Link>
          {/* you can add more later: privacy, refund policy, etc. */}
          <Link href="/privacy" className="text-slate-400 hover:text-emerald-300">
          
    Privacy Policy
  </Link>

  <Link href="/refund-policy">Refund & Replacement Policy</Link>
<Link href="/cookie-policy">Cookie Policy</Link>

        </div>
      </div>
    </footer>
  );
}
