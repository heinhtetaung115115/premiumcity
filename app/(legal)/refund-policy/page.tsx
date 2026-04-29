import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Refund & Replacement Policy — PremiumCity'
};

export default function RefundPolicyPage() {
  return (
    <section className="prose prose-invert max-w-4xl">
      <h1>Refund & Replacement Policy</h1>
      <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>

      <p>
        At <strong>PremiumCity</strong>, we aim to deliver reliable and high-quality digital
        services including streaming accounts, VPN subscriptions, gift cards, and
        software access. Because our products are <strong>digital and instantly accessible</strong>,
        special conditions apply to refunds and replacements.
      </p>

      <h2>1) Eligibility for Refunds</h2>
      <p>A refund may be approved only if:</p>
      <ul>
        <li>
          ✔ The product was paid for but <strong>not delivered</strong>.
        </li>
        <li>
          ✔ The product was delivered but <strong>cannot be used</strong>, and we are unable
          to provide a working replacement.
        </li>
      </ul>
      <p>
        If the product was successfully delivered and working, <strong>no refund will be provided.</strong>
      </p>

      <h2>2) Replacement Policy (Digital Accounts)</h2>
      <p>
        If a purchased account stops working during the purchased validity period, we
        will provide a <strong>free replacement</strong>.
      </p>

      <table>
        <thead>
          <tr>
            <th>Product Duration</th>
            <th>Replacement Coverage</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1 day</td>
            <td>1 day from delivery</td>
          </tr>
          <tr>
            <td>1 week</td>
            <td>7 days from delivery</td>
          </tr>
          <tr>
            <td>1 month</td>
            <td>30 days from delivery</td>
          </tr>
        </tbody>
      </table>

      <p>
        Replacement is provided <strong>only if stock is available</strong>. If no replacement is
        available, a refund may be granted.
      </p>

      <h2>3) Required Proof</h2>
      <p>To request a refund or replacement, you must provide:</p>
      <ul>
        <li><strong>A:</strong> Screenshot of payment receipt / top-up proof</li>
        <li><strong>D:</strong> Order ID + Email used during purchase</li>
      </ul>

      <h2>4) Refund Method</h2>
      <p>Refunds will be processed using the <strong>same method the customer used</strong> whenever possible.</p>
      <p>Example:</p>
      <ul>
        <li>Bank transfer → refunded to same bank account</li>
        <li>Wave/KPay/KBZPay → refunded to same phone number</li>
        <li>Crypto → refunded to same wallet address</li>
      </ul>

      <h2>5) Non-Refundable Situations</h2>
      <p>Refunds do <strong>not</strong> apply to:</p>
      <ul>
        <li>Wrong purchase decision or change of mind</li>
        <li>Customer unable to use product due to device/location restrictions</li>
        <li>Account banned or restricted due to misuse or sharing credentials</li>
        <li>Violation of platform Terms of Service</li>
      </ul>

      <h2>6) Security Requirements</h2>
      <p>To stay eligible for replacement:</p>
      <ul>
        <li>Do not modify account password, profiles, or settings</li>
        <li>Do not share or resell access</li>
        <li>Do not exceed allowed number of streams/profiles</li>
      </ul>

      <h2>7) Contact Support</h2>
      <p>To request a refund or replacement, contact our support:</p>
      <ul>
        <li>📩 Email: <strong>support@premiumcity.store</strong></li>
        <li>💬 Telegram: <strong>@premiumcity_support</strong></li>
        <li>📱 Viber: <strong>+95 XXXXXXXX</strong></li>
      </ul>

      <p>Thank you for choosing <strong>PremiumCity</strong>.</p>
    </section>
  );
}
