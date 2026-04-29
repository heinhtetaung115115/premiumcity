// app/privacy/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PremiumCity'
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Privacy Policy
        </h1>
        <p className="text-sm text-slate-400">
          Last updated: {new Date().toLocaleDateString('en-GB')}
        </p>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-slate-200">
        <p>
          This Privacy Policy explains how PremiumCity (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;) collects, uses, and protects your personal
          information when you use our digital storefront and related services.
          By accessing or using PremiumCity, you agree to the terms described in
          this Privacy Policy.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          1. Information We Collect
        </h2>
        <p>We may collect the following types of data:</p>

        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>
            <span className="font-semibold">Account details</span> — email,
            name, phone number (if provided).
          </li>
          <li>
            <span className="font-semibold">Wallet top-up verification</span> —
            transaction screenshots, bank name, last 4 digits of the
            transaction ID.
          </li>
          <li>
            <span className="font-semibold">Order details</span> — products,
            user-provided info for manual delivery (email, profile URL, phone,
            etc.).
          </li>
          <li>
            <span className="font-semibold">Technical data</span> — IP address,
            device, browser information, and general activity for security
            purposes.
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          2. How We Use Your Data
        </h2>
        <p>Your data is used for purposes such as:</p>

        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Creating and managing user accounts</li>
          <li>Processing wallet top-ups and verifying payments</li>
          <li>Delivering digital products (instant or manual)</li>
          <li>Preventing fraud and unauthorized account usage</li>
          <li>Improving our services and support</li>
          <li>Sending important account, security, or order notifications</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          3. Cookies & Tracking
        </h2>
        <p>
          PremiumCity may use cookies or similar technologies to enhance your
          browsing experience and keep you signed in. You may disable cookies in
          your browser settings, but parts of the website may not function
          correctly.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          4. Data Security
        </h2>
        <p>
          We use reasonable security measures to protect your data. However, no
          system can be guaranteed 100% secure, and you share information at
          your own risk. You are responsible for maintaining the confidentiality
          of your account credentials.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          5. Sharing Your Information
        </h2>
        <p>
          We do <span className="font-semibold">not</span> sell or rent your
          information. We may share limited data only when necessary for:
        </p>

        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Payment verification and anti-fraud checks</li>
          <li>Technical infrastructure (e.g., Supabase, email provider)</li>
          <li>Legal requirements or protection of our platform</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          6. Data Retention & Deletion
        </h2>
        <p>
          We keep your data only as long as necessary for account management,
          legal compliance, and fraud prevention. You may request account
          deletion by contacting support on our{' '}
          <a href="/contact" className="text-emerald-400 hover:text-emerald-300">
            Contact page
          </a>
          . Some transaction history may be retained as required by law.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          7. Children’s Privacy
        </h2>
        <p>
          PremiumCity is not intended for children under the age of 13. We do
          not knowingly collect personal data from children.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          8. Updates to This Policy
        </h2>
        <p>
          We may update this Privacy Policy. Changes will be posted on this
          page, and your continued use of PremiumCity means you accept the
          updated version.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200 pb-10">
        <h2 className="text-base font-semibold text-slate-50">
          9. Contact Us
        </h2>
        <p>
          If you have questions about this Privacy Policy, please reach out via
          our{' '}
          <a href="/contact" className="text-emerald-400 hover:text-emerald-300">
            Contact page
          </a>
          .
        </p>
      </section>
    </main>
  );
}
