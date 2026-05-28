import { Link } from 'react-router-dom'

const LAST_UPDATED = 'May 27, 2026'
const CONTACT_EMAIL = 'vikasvikas988099@gmail.com'

function Section({ title, children }) {
  return (
    <div
      className="mb-6 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(124,58,237,0.15)',
        padding: '24px 28px',
      }}
    >
      <h2 className="text-violet-400 font-extrabold text-[15px] mb-3 tracking-wide uppercase">
        {title}
      </h2>
      <div className="text-slate-300 text-[14px] leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  )
}

export default function PrivacyPolicy() {
  return (
    <div
      className="min-h-screen font-body"
      style={{ background: 'radial-gradient(ellipse at top, #1a0533 0%, #050311 60%)' }}
    >
      {/* Top nav */}
      <div
        className="sticky top-0 z-10 backdrop-blur-[12px]"
        style={{ background: 'rgba(5,3,17,0.92)', borderBottom: '1px solid rgba(124,58,237,0.15)' }}
      >
        <div className="max-w-[820px] mx-auto px-4 h-[52px] flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-[6px] text-slate-400 hover:text-white transition-colors text-[13px] font-semibold no-underline"
          >
            ← Back
          </Link>
          <span className="text-slate-700 text-[12px]">|</span>
          <span className="text-slate-400 text-[13px]">Privacy Policy</span>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-4 py-10 pb-20">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-[52px] mb-3">🌍</div>
          <h1 className="text-[28px] font-extrabold text-white mb-1">Cartoon Life Universe</h1>
          <p className="text-violet-400 text-[13px] font-semibold">Privacy Policy</p>
          <p className="text-slate-600 text-[12px] mt-2">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* Intro */}
        <div
          className="mb-6 rounded-2xl text-slate-300 text-[14px] leading-relaxed"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', padding: '20px 28px' }}
        >
          This Privacy Policy explains how Cartoon Life Universe (&quot;we&quot;, &quot;our&quot;, or &quot;the game&quot;) collects, uses, and protects your personal information when you use our service. By playing the game, you agree to the practices described in this policy.
        </div>

        <Section title="1. Information We Collect">
          <p><strong className="text-slate-100">Account information:</strong> When you sign in, we receive your name and email address through Clerk, our authentication provider.</p>
          <p><strong className="text-slate-100">Game data:</strong> Your in-game position, activity, coins, gems, avatar customization, chat messages, and mission progress are stored in our Supabase database.</p>
          <p><strong className="text-slate-100">Payment information:</strong> When you make a purchase, payment is processed securely by Razorpay. We do not receive or store your card number, UPI ID, or other sensitive payment details.</p>
          <p><strong className="text-slate-100">Technical data:</strong> Basic browser and device information may be collected automatically for performance and security purposes.</p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>• To provide, operate, and improve the game experience.</p>
          <p>• To sync your game progress and avatar across sessions.</p>
          <p>• To process payments and credit coins and gems to your account.</p>
          <p>• To moderate the platform and enforce our Terms and Conditions.</p>
          <p>• To communicate important updates about the game.</p>
        </Section>

        <Section title="3. Data Storage & Security">
          <p>Your game data is stored securely on Supabase servers. We use industry-standard security practices including encrypted connections and access controls.</p>
          <p>Authentication is handled by Clerk, which uses secure, encrypted session management. We do not store your passwords.</p>
          <p>We take reasonable steps to protect your information, but no internet service can guarantee 100% security.</p>
        </Section>

        <Section title="4. Payments & Razorpay">
          <p>All purchases in Cartoon Life Universe are processed by Razorpay, a PCI-DSS compliant payment processor operating under Indian regulations.</p>
          <p>We do not store, access, or log your card numbers, UPI IDs, net banking credentials, or any other payment credentials.</p>
          <p>Razorpay&apos;s own privacy policy governs the data they collect during payment processing.</p>
        </Section>

        <Section title="5. Data Sharing">
          <p>We do not sell, rent, or trade your personal information to third parties.</p>
          <p>We share data only with our service providers (Clerk for authentication, Supabase for storage, Razorpay for payments) to the extent necessary to operate the game.</p>
          <p>We may disclose information if required by law or to protect the rights and safety of our users.</p>
        </Section>

        <Section title="6. Cookies">
          <p>We use cookies and local storage only for authentication session management. We do not use tracking or advertising cookies.</p>
          <p>Your browser may store session tokens that keep you signed in between visits. You can clear these through your browser settings.</p>
        </Section>

        <Section title="7. Children's Privacy">
          <p>Cartoon Life Universe is not intended for children under the age of 13. We do not knowingly collect personal information from users under 13.</p>
          <p>If you believe a child under 13 has provided us with personal information, please contact us immediately and we will remove it.</p>
        </Section>

        <Section title="8. Your Rights & Data Deletion">
          <p>You have the right to access, correct, or delete your personal data.</p>
          <p>To request deletion of your account and associated data, please email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors">
              {CONTACT_EMAIL}
            </a>.
          </p>
          <p>We will process deletion requests within 30 days.</p>
        </Section>

        <Section title="9. Policy Updates">
          <p>We may update this Privacy Policy from time to time. When we do, we will update the &quot;Last updated&quot; date at the top of this page.</p>
          <p>Significant changes will be communicated to users through in-game notifications or email where possible.</p>
          <p>Continued use of the game after changes constitutes your acceptance of the updated policy.</p>
        </Section>

        <Section title="10. Contact Us">
          <p>If you have any questions or concerns about this Privacy Policy or your data, please contact us at:</p>
          <p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors font-semibold">
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>

        {/* Footer links */}
        <div
          className="mt-8 pt-6 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-center gap-4 flex-wrap mb-4 text-[12px]">
            <Link to="/terms-and-conditions" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">Terms &amp; Conditions</Link>
            <span className="text-slate-700">·</span>
            <Link to="/about-us" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">About Us</Link>
            <span className="text-slate-700">·</span>
            <Link to="/" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">Back to Game</Link>
          </div>
          <p className="text-slate-700 text-[11px]">© 2025 Cartoon Life Universe. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
