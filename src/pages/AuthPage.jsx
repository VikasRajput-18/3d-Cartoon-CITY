import { SignIn } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'

export default function AuthPage() {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center font-body overflow-auto overflow-x-hidden py-4"
      style={{
        background: 'radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.18) 0%, transparent 60%), #050311',
      }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 360, height: 360,
          background: 'rgba(124,58,237,0.12)',
          filter: 'blur(100px)',
          top: -80, left: -80,
        }}
      />
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 280, height: 280,
          background: 'rgba(219,39,119,0.10)',
          filter: 'blur(100px)',
          bottom: -60, right: -60,
        }}
      />

      {/* Logo / title */}
      <div className="text-center mb-6 z-[1]">
        <div className="text-[48px] mb-2">🌍</div>
        <div className="text-[26px] font-extrabold text-white tracking-[-0.02em] leading-[1.1]">
          Cartoon Life Universe
        </div>
        <div className="text-white/40 text-[13px] mt-[6px]">
          Sign in to enter the city
        </div>
      </div>

      {/* Clerk SignIn component with dark theme */}
      <div className="z-[1] w-full max-w-[400px] px-4">
        <SignIn
          routing="hash"
          afterSignInUrl="/"
          afterSignUpUrl="/"
          appearance={{
            variables: {
              colorPrimary: '#7c3aed',
              colorBackground: 'rgba(15,10,30,0.98)',
              colorInputBackground: 'rgba(255,255,255,0.06)',
              colorInputText: '#e2e8f0',
              colorText: '#e2e8f0',
              colorTextSecondary: 'rgba(226,232,240,0.55)',
              borderRadius: '12px',
              fontFamily: 'Nunito, sans-serif',
            },
            elements: {
              card: {
                background: 'rgba(15,10,30,0.96)',
                border: '1.5px solid rgba(124,58,237,0.35)',
                borderRadius: 16,
                boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
              },
              headerTitle: { color: '#fff', fontWeight: 700 },
              headerSubtitle: { color: 'rgba(255,255,255,0.45)' },
              socialButtonsBlockButton: {
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2e8f0',
              },
              socialButtonsBlockButton__hover: {
                background: 'rgba(255,255,255,0.1)',
              },
              dividerLine: { background: 'rgba(255,255,255,0.1)' },
              dividerText: { color: 'rgba(255,255,255,0.3)' },
              formFieldLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
              formFieldInput: {
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2e8f0',
              },
              formButtonPrimary: {
                background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
                fontWeight: 700,
                letterSpacing: '0.02em',
              },
              footerActionLink: { color: '#a78bfa' },
              identityPreviewText: { color: '#e2e8f0' },
              identityPreviewEditButton: { color: '#a78bfa' },
            },
          }}
        />
      </div>

      {/* Footer links */}
      <div className="z-[1] mt-6 flex items-center gap-3 flex-wrap justify-center">
        <Link to="/about-us" className="text-slate-600 hover:text-slate-400 transition-colors text-[11px] no-underline">About Us</Link>
        <span className="text-slate-800 text-[10px]">·</span>
        <Link to="/privacy-policy" className="text-slate-600 hover:text-slate-400 transition-colors text-[11px] no-underline">Privacy Policy</Link>
        <span className="text-slate-800 text-[10px]">·</span>
        <Link to="/terms-and-conditions" className="text-slate-600 hover:text-slate-400 transition-colors text-[11px] no-underline">Terms &amp; Conditions</Link>
      </div>
      <p className="z-[1] mt-2 text-slate-800 text-[10px]">© 2025 Cartoon Life Universe</p>
    </div>
  )
}
