import { SignIn } from '@clerk/clerk-react'

export default function AuthPage() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.18) 0%, transparent 60%), #050311',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Nunito, sans-serif',
      overflow: 'auto', padding: '16px 0',
    }} className='overflow-x-hidden'>
      {/* Decorative orbs */}
      <div style={{
        position: 'absolute', width: 360, height: 360, borderRadius: '50%',
        background: 'rgba(124,58,237,0.12)', filter: 'blur(100px)',
        top: -80, left: -80, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 280, height: 280, borderRadius: '50%',
        background: 'rgba(219,39,119,0.10)', filter: 'blur(100px)',
        bottom: -60, right: -60, pointerEvents: 'none',
      }} />

      {/* Logo / title */}
      <div style={{ textAlign: 'center', marginBottom: 24, zIndex: 1 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌍</div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: '#fff',
          letterSpacing: '-0.02em', lineHeight: 1.1,
        }}>
          Cartoon Life Universe
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>
          Sign in to enter the city
        </div>
      </div>

      {/* Clerk SignIn component with dark theme */}
      <div style={{ zIndex: 1, width: '100%', maxWidth: 400, padding: '0 16px' }}>
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
    </div>
  )
}
