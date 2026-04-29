import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cookie Policy — PremiumCity'
};

export default function CookiePolicyPage() {
  return (
    <section className="prose prose-invert max-w-4xl">
      <h1>Cookie Policy</h1>
      <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>

      <p>
        This Cookie Policy explains how <strong>PremiumCity</strong> (“we”, “our”, or “us”)
        uses cookies and similar tracking technologies on our website. By
        accessing or using our website, you agree to the use of cookies as
        described in this policy.
      </p>

      <h2>1) What are cookies?</h2>
      <p>
        Cookies are small text files stored on your device when you visit a
        website. They help improve user experience and enable certain
        functionalities such as authentication, remembering user preferences,
        and analytics.
      </p>

      <h2>2) How we use cookies</h2>
      <p>We use cookies for the following purposes:</p>
      <ul>
        <li><strong>Essential Cookies</strong> – Required for core functionality such as logging into your account, purchasing products, verifying wallet top-ups and processing orders.</li>
        <li><strong>Performance & Analytics Cookies</strong> – These help us analyze site usage and improve functionality. (e.g., Google Analytics, server logs, error monitoring)</li>
        <li><strong>Preference Cookies</strong> – Remember your settings such as language and theme preferences.</li>
      </ul>

      <p>We do <strong>not</strong> use cookies for advertising or cross-site tracking.</p>

      <h2>3) Cookie duration</h2>
      <ul>
        <li><strong>Session cookies:</strong> Deleted automatically when you close your browser.</li>
        <li><strong>Persistent cookies:</strong> Remain on your device for a limited period or until you delete them.</li>
      </ul>

      <h2>4) Third-party cookies</h2>
      <p>
        Some services we use may place their own cookies, such as:
      </p>
      <ul>
        <li>Supabase Authentication & Security</li>
        <li>Payment verification services (for wallet top-ups)</li>
        <li>Analytics tools (if enabled)</li>
      </ul>
      <p>These providers have their own privacy and cookie policies.</p>

      <h2>5) Managing cookie preferences</h2>
      <p>
        You can disable cookies in your browser settings. However, doing so may
        impact certain functionalities of the site, including logging into your
        account or completing purchases.
      </p>

      <h2>6) Updates to this policy</h2>
      <p>
        We may update this Cookie Policy from time to time. Changes will be
        posted on this page with a new Last Updated date.
      </p>

      <h2>7) Contact us</h2>
      <p>If you have questions about this Cookie Policy, you may contact us:</p>
      <ul>
        <li>📩 Email: <strong>support@premiumcity.store</strong></li>
        <li>💬 Telegram: <strong>@premiumcity_support</strong></li>
        <li>📱 Viber: <strong>+95 XXXXXXXX</strong></li>
      </ul>

      <p>Thank you for using <strong>PremiumCity</strong>.</p>
    </section>
  );
}
