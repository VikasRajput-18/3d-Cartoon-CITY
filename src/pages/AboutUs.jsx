import { Link } from 'react-router-dom'

const CONTACT_EMAIL = 'vikasvikas988099@gmail.com'

const TECH_STACK = [
  { icon: '⚛️', name: 'React', desc: 'UI framework' },
  { icon: '🌐', name: 'Three.js', desc: '3D rendering' },
  { icon: '🗄️', name: 'Supabase', desc: 'Backend & realtime' },
  { icon: '🤖', name: 'Groq AI', desc: 'NPC conversations' },
  { icon: '🔐', name: 'Clerk', desc: 'Authentication' },
  { icon: '💳', name: 'Razorpay', desc: 'Payments' },
]

const FEATURES = [
  { icon: '🏙️', title: 'Explore a Cartoon City', desc: 'Roam a hand-crafted city with shops, parks, race tracks, and hidden spots.' },
  { icon: '👥', title: 'Meet Other Players', desc: 'Real-time multiplayer — see and chat with other players live in the world.' },
  { icon: '🎮', title: 'Mini Games', desc: 'Racing, shooting, fishing, football and more. Win coins to spend in the world.' },
  { icon: '🎯', title: 'Daily Missions', desc: 'Complete challenges every day to earn rewards and climb the leaderboards.' },
  { icon: '👗', title: 'Avatar Customization', desc: 'Express yourself with skin tones, hair colors, and outfit styles.' },
  { icon: '🤖', title: 'AI-Powered NPCs', desc: 'Chat with intelligent NPCs powered by Groq AI. Every conversation is unique.' },
]

export default function AboutUs() {
  return (
    <div
      className="min-h-screen overflow-auto font-body"
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
          <span className="text-slate-400 text-[13px]">About Us</span>
        </div>
      </div>

      <div className="max-w-[820px] mx-auto px-4 py-10 pb-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="text-[64px] mb-4">🌍</div>
          <h1 className="text-[32px] font-extrabold text-white mb-2 leading-tight">
            Cartoon Life Universe
          </h1>
          <p className="text-violet-400 text-[15px] font-semibold mb-4">
            A multiplayer 3D social game
          </p>
          <p className="text-slate-400 text-[14px] leading-relaxed max-w-[560px] mx-auto">
            Explore a cartoon city, meet real players, play mini games, complete missions, and live your best cartoon life — all in your browser.
          </p>
        </div>

        {/* Story */}
        <div
          className="mb-8 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(236,72,153,0.06))',
            border: '1px solid rgba(124,58,237,0.25)',
            padding: '28px',
          }}
        >
          <h2 className="text-white font-extrabold text-[18px] mb-4">The Story</h2>
          <div className="text-slate-300 text-[14px] leading-relaxed space-y-3">
            <p>
              Cartoon Life Universe was built by an independent developer with a passion for creating fun, social, interactive experiences on the web. The idea was simple: what if you could hang out with friends in a living cartoon world, right from your browser?
            </p>
            <p>
              This is a passion project that started small and keeps growing with its community. Every feature — from AI-powered NPCs to multiplayer mini games — was added based on what makes the experience more alive and fun.
            </p>
            <p>
              We believe the best games are the ones you play with others. That&apos;s why real-time multiplayer, chat, and social features are at the heart of everything we build.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mb-8">
          <h2 className="text-white font-extrabold text-[18px] mb-5">What You Can Do</h2>
          <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(124,58,237,0.15)',
                  padding: '18px 20px',
                }}
              >
                <div className="text-[26px] mb-2">{f.icon}</div>
                <div className="text-slate-100 font-bold text-[14px] mb-1">{f.title}</div>
                <div className="text-slate-500 text-[12px] leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div
          className="mb-8 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(124,58,237,0.15)',
            padding: '24px 28px',
          }}
        >
          <h2 className="text-white font-extrabold text-[18px] mb-5">Built With</h2>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {TECH_STACK.map(t => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="text-[22px]">{t.icon}</span>
                <div>
                  <div className="text-slate-200 font-bold text-[13px]">{t.name}</div>
                  <div className="text-slate-600 text-[11px]">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Community & growth */}
        <div
          className="mb-8 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(124,58,237,0.15)',
            padding: '24px 28px',
          }}
        >
          <h2 className="text-violet-400 font-extrabold text-[15px] mb-3 tracking-wide uppercase">Growing With the Community</h2>
          <div className="text-slate-300 text-[14px] leading-relaxed space-y-2">
            <p>We are constantly adding new features, mini games, missions, and city areas. The roadmap is shaped by player feedback and what makes the world feel more alive.</p>
            <p>If you have ideas, bug reports, or just want to say hi — we&apos;d love to hear from you.</p>
          </div>
        </div>

        {/* Social / Contact */}
        <div
          className="mb-8 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(124,58,237,0.15)',
            padding: '24px 28px',
          }}
        >
          <h2 className="text-violet-400 font-extrabold text-[15px] mb-4 tracking-wide uppercase">Find Us</h2>

          <div className="flex flex-wrap gap-3 mb-5">
            {[
              { icon: '📸', name: 'Instagram', placeholder: 'Coming soon' },
              { icon: '🐦', name: 'Twitter / X', placeholder: 'Coming soon' },
              { icon: '💬', name: 'Discord', placeholder: 'Coming soon' },
            ].map(s => (
              <div
                key={s.name}
                className="flex items-center gap-2 rounded-xl text-[13px]"
                style={{
                  background: 'rgba(124,58,237,0.1)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  padding: '10px 16px',
                }}
              >
                <span className="text-[18px]">{s.icon}</span>
                <div>
                  <div className="text-slate-300 font-semibold">{s.name}</div>
                  <div className="text-slate-600 text-[11px]">{s.placeholder}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-slate-300 text-[14px]">
            <span className="text-slate-500">Email: </span>
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-violet-400 hover:text-violet-300 transition-colors font-semibold">
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        {/* Footer links */}
        <div
          className="mt-8 pt-6 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-center gap-4 flex-wrap mb-4 text-[12px]">
            <Link to="/privacy-policy" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">Privacy Policy</Link>
            <span className="text-slate-700">·</span>
            <Link to="/terms-and-conditions" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">Terms &amp; Conditions</Link>
            <span className="text-slate-700">·</span>
            <Link to="/" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">Back to Game</Link>
          </div>
          <p className="text-slate-700 text-[11px]">© 2025 Cartoon Life Universe. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}
