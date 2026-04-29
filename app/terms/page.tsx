// app/terms/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions — PremiumCity'
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">
          Terms &amp; Conditions
        </h1>
        <p className="text-sm text-slate-400">
          Last updated: {new Date().toLocaleDateString('en-GB')}
        </p>
      </header>

      <section className="space-y-4 text-sm leading-relaxed text-slate-200">
        <p>
          These Terms &amp; Conditions (&quot;Terms&quot;) govern your use of the
          PremiumCity digital storefront (&quot;we&quot;, &quot;us&quot;,
          &quot;our&quot;) and all services provided on this website
          (&quot;Service&quot;). By using PremiumCity, creating an account,
          topping up your wallet, or purchasing any digital product, you agree
          to be bound by these Terms.
        </p>
        <p>
          If you do not agree with these Terms, you must not use our Service.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          1. Eligibility &amp; Accounts
        </h2>
        <p>
          You must be at least 18 years old, or the age of legal majority in
          your country, to use this Service. You are responsible for maintaining
          the security of your account, including your login details and any
          activity under your account.
        </p>
        <p>
          You agree to provide accurate and up-to-date information when
          registering and when placing orders (for example, correct email,
          profile details for manual orders, etc.).
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          2. Digital Products &amp; Delivery
        </h2>
        <p>
          PremiumCity sells digital products such as accounts, vouchers,
          subscriptions, and other virtual goods. There are two main delivery
          types:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>
            <span className="font-semibold">Instant delivery</span> — access
            details (credentials, codes, etc.) are shown immediately on the
            website after payment is confirmed.
          </li>
          <li>
            <span className="font-semibold">Manual delivery</span> — we manually
            prepare and deliver access based on the details you provide during
            checkout. Delivery time is usually within{' '}
            <span className="font-semibold">15 minutes to 8 hours</span> after
            your payment is confirmed, depending on stock and verification.
          </li>
        </ul>
        <p>
          You are responsible for saving and securely storing any credentials,
          codes, or access details we provide. Once they are shown to you or
          delivered to your contact address, they are considered delivered.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          3. Wallet Top-Up &amp; Balance
        </h2>
        <p>
          PremiumCity uses a wallet-based payment system. You can add money to
          your wallet using supported payment methods (such as bank transfer).
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>
            Top-ups are credited in Myanmar Kyat (MMK / Ks) or as specified at
            the time of payment.
          </li>
          <li>
            All top-ups are subject to{' '}
            <span className="font-semibold">manual verification</span>. We may
            ask for transaction screenshots, last 4 digits of your transaction
            ID, or other proof.
          </li>
          <li>
            <span className="font-semibold">Top-ups are non-refundable</span>{' '}
            once they are confirmed and added to your wallet, except where
            required by law.
          </li>
        </ul>
        <p>
          If we detect suspicious or fraudulent top-up activity, we may hold,
          freeze, or remove wallet balance and suspend or close your account.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          4. Pricing, Currency &amp; Changes
        </h2>
        <p>
          All prices are shown in MMK (Ks) unless otherwise stated. We reserve
          the right to change product prices, discounts, and stock availability
          at any time without prior notice.
        </p>
        <p>
          If a pricing or listing error is discovered after your order, we
          reserve the right to cancel or adjust the order. In such cases, we
          will contact you and either deliver the correct product or issue a
          wallet adjustment or refund according to our policies.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          5. Refunds, Replacements &amp; Disputes
        </h2>
        <p className="font-semibold">
          Because our products are digital and often consumed immediately,{' '}
          refunds are generally not provided.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>
            For <span className="font-semibold">instant delivery</span>{' '}
            products, once credentials or codes are shown to you, the sale is
            considered final.
          </li>
          <li>
            For <span className="font-semibold">manual delivery</span> products,
            we will attempt to deliver working access according to the product
            description. If the delivered credentials do not work, you must
            contact us within a reasonable time (for example within 24 hours) so
            we can verify and replace where possible.
          </li>
        </ul>
        <p>
          We do not accept chargebacks or disputes made in bad faith. Abuse of
          payment disputes or chargebacks may result in permanent account
          suspension and blacklist from future purchases.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          6. Acceptable Use &amp; Prohibited Activities
        </h2>
        <p>You agree not to use our Service to:</p>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Violate any applicable laws or regulations.</li>
          <li>
            Resell or redistribute products in a way that breaches the original
            platform&apos;s terms (for example, sharing subscription accounts
            where prohibited).
          </li>
          <li>
            Engage in fraud, scams, abuse, or payment chargebacks without valid
            reasons.
          </li>
          <li>
            Attempt to hack, attack, or disrupt PremiumCity or any third-party
            services connected to our products.
          </li>
        </ul>
        <p>
          We reserve the right to suspend or terminate accounts that violate
          these rules without prior notice.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          7. Intellectual Property
        </h2>
        <p>
          All logos, branding, website design, and content displayed on
          PremiumCity are our property or used with permission. You may not copy
          or reuse our branding or content without our written consent.
        </p>
        <p>
          Some products may belong to third-party platforms or services. Those
          trademarks, logos, and brand names are the property of their
          respective owners.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          8. Limitation of Liability
        </h2>
        <p>
          To the maximum extent permitted by law, PremiumCity is not liable for
          any indirect, incidental, special, or consequential damages arising
          out of your use of our Service, including loss of profit, account
          bans, or suspension by third-party platforms.
        </p>
        <p>
          Our total liability for any claim related to your use of the Service
          will not exceed the total amount you paid to PremiumCity in the 30
          days before the issue arose.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200">
        <h2 className="text-base font-semibold text-slate-50">
          9. Changes to These Terms
        </h2>
        <p>
          We may update these Terms from time to time. When we do, we will
          update the &quot;Last updated&quot; date at the top of this page.
          Your continued use of the Service after changes are posted means you
          accept the updated Terms.
        </p>
      </section>

      <section className="space-y-3 text-sm text-slate-200 pb-10">
        <h2 className="text-base font-semibold text-slate-50">
          10. Contact Us
        </h2>
        <p>
          If you have any questions about these Terms or need help with an
          order, you can contact us through the channels listed on our{' '}
          <a
            href="/contact"
            className="text-emerald-400 hover:text-emerald-300"
          >
            Contact page
          </a>
          .
        </p>
        <p className="text-xs text-slate-500">
          This document is provided for general information only and does not
          constitute formal legal advice. For business-critical use, consider
          asking a lawyer to review and customize these Terms for your specific
          situation.
        </p>
      </section>
    </main>
  );
}
