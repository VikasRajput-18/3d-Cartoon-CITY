import { Link } from 'react-router-dom'

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

export default function TermsAndConditions() {
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
          <span className="text-slate-400 text-[13px]">Terms &amp; Conditions</span>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-4 py-10 pb-20">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="text-[52px] mb-3">📜</div>
          <h1 className="text-[28px] font-extrabold text-white mb-1">Cartoon Life Universe</h1>
          <p className="text-violet-400 text-[13px] font-semibold">Terms &amp; Conditions</p>
        </div>

        {/* Intro */}
        <div
          className="mb-6 rounded-2xl text-slate-300 text-[14px] leading-relaxed"
          style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', padding: '20px 28px' }}
        >
          By accessing or using Cartoon Life Universe (&quot;the game&quot;, &quot;the service&quot;), you agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use this service.
        </div>

        <Section title="1. Eligibility">
          <p>You must be at least 13 years old to use Cartoon Life Universe. By using this service, you confirm that you meet this age requirement.</p>
          <p>If you are under 18, you should have your parent or guardian review these terms before using the service.</p>
        </Section>

        <Section title="2. User Accounts">
          <p>You are responsible for maintaining the security of your account credentials.</p>
          <p>You must not share your account with others or allow others to access it on your behalf.</p>
          <p>You are responsible for all activity that occurs under your account.</p>
          <p>We reserve the right to suspend or terminate accounts that violate these terms.</p>
        </Section>

        <Section title="3. Virtual Currency & Items">
          <p><strong className="text-slate-100">No real-world value:</strong> Virtual coins, gems, and any other in-game items have no real-world monetary value and cannot be redeemed, transferred, or exchanged for real money or real-world goods.</p>
          <p><strong className="text-slate-100">Discretionary changes:</strong> We reserve the right to modify, remove, or adjust virtual items, their availability, and their in-game value at any time at our discretion.</p>
          <p><strong className="text-slate-100">No ownership:</strong> All virtual items remain the property of Cartoon Life Universe. You receive a limited, non-transferable license to use them within the game.</p>
        </Section>

        <Section title="4. Purchases & Refund Policy">
          <p><strong className="text-slate-100">All purchases are final.</strong> Once a coin or gem pack is purchased and credited to your account, the transaction is complete and non-refundable, except where required by applicable law.</p>
          <p>If you believe there has been an error with your purchase (e.g., coins not credited), please contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors">
              {CONTACT_EMAIL}
            </a>{' '}within 7 days of the transaction.
          </p>
          <p>Payments are processed by Razorpay. Any payment disputes are subject to Razorpay&apos;s policies and Indian consumer protection laws.</p>
        </Section>

        <Section title="5. Prohibited Conduct">
          <p>While using Cartoon Life Universe, you must not:</p>
          <p>• Use cheats, hacks, bots, or third-party software to gain unfair advantages.</p>
          <p>• Exploit bugs, glitches, or unintended game mechanics. (Please report them to us instead.)</p>
          <p>• Harass, bully, threaten, or abuse other players in any way.</p>
          <p>• Share offensive, hateful, or illegal content in the chat or any other communication feature.</p>
          <p>• Impersonate other players, staff, or any real person.</p>
          <p>• Attempt to gain unauthorized access to our servers, databases, or other systems.</p>
          <p>• Use the service for any commercial purpose without our explicit written consent.</p>
        </Section>

        <Section title="6. Enforcement & Bans">
          <p>We reserve the right to investigate violations and take appropriate action, including temporary suspension or permanent banning of accounts.</p>
          <p>Bans may be issued without prior warning for serious violations such as hacking, harassment, or exploiting.</p>
          <p>No refunds will be provided for purchases made on accounts that are banned due to violations of these terms.</p>
        </Section>

        <Section title="7. Availability & Changes">
          <p>We make no guarantee of continuous, uninterrupted access to the game. Maintenance, updates, or technical issues may cause temporary downtime.</p>
          <p>We are not responsible for loss of game progress or data resulting from internet connectivity issues on your end.</p>
          <p>We reserve the right to modify, suspend, or discontinue any part of the service at any time with or without notice.</p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>All content in Cartoon Life Universe, including graphics, music, code, game mechanics, and characters, is owned by the developer and protected under applicable intellectual property laws.</p>
          <p>You may not copy, redistribute, or create derivative works from any part of the game without prior written permission.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>Cartoon Life Universe is provided &quot;as is&quot; without warranties of any kind, express or implied.</p>
          <p>To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.</p>
        </Section>

        <Section title="10. Governing Law & Disputes">
          <p>These Terms and Conditions are governed by the laws of India.</p>
          <p>Any disputes arising from these terms or your use of the service shall be resolved under Indian law.</p>
          <p>By using this service, you consent to the jurisdiction of courts in India for any legal matters.</p>
        </Section>

        <Section title="11. Contact">
          <p>For any questions about these terms, please contact us at:</p>
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
            <Link to="/privacy-policy" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">Privacy Policy</Link>
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
