import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { useStore } from '@/store'
import { motion, AnimatePresence } from 'framer-motion'

const SKINS  = ['#FDDBB4','#F4C08A','#D4956A','#C68642','#8D5524','#4A2C0A']
const HAIRS  = ['#2C1810','#7B3F00','#C19A6B','#FFD700','#1B1B3A','#FF6B6B','#6B48FF','#E8E8E8']
const OUTFITS = ['casual','school','party','traditional','winter','sports']

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { completeOnboarding, setAvatar } = useStore()

  const [step,   setStep]   = useState(0)
  const [skin,   setSkin]   = useState('#F4C08A')
  const [hair,   setHair]   = useState('#2C1810')
  const [outfit, setOutfit] = useState('casual')

  const steps = ['welcome', 'looks', 'done']
  const current = steps[step]

  const playerName = user?.fullName || user?.firstName || user?.username || 'Player'

  function finish() {
    setAvatar({ skin, hair, outfit, expression: 'happy' })
    completeOnboarding({ name: playerName, skin, hair, outfit, expression: 'happy' })
    navigate('/')
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-night-950 overflow-hidden">
      <div className="absolute w-96 h-96 bg-purple-800 rounded-full blur-[120px] opacity-20 -top-20 -left-20" />
      <div className="absolute w-80 h-80 bg-pink-800 rounded-full blur-[120px] opacity-15 -bottom-20 -right-20" />

      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
          animate={{ width: `${(step / (steps.length - 1)) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="w-full max-w-sm px-6 space-y-6"
        >
          {current === 'welcome' && (
            <div className="text-center space-y-4">
              <div className="text-7xl animate-float">🌍</div>
              <h1 className="font-display text-4xl text-white">Cartoon Life<br/>Universe</h1>
              <p className="text-white/50 text-sm leading-relaxed">
                Hey <span className="text-purple-300 font-bold">{playerName}</span>! Welcome to the city.<br/>
                Chat with NPCs. Do activities.<br/>
                Live your cartoon life!
              </p>
              <button onClick={() => setStep(1)}
                className="btn w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-base mt-4">
                Let's go! 🚀
              </button>
            </div>
          )}

          {current === 'looks' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-2">🎨</div>
                <h2 className="font-display text-2xl text-white">Your look</h2>
              </div>

              <div className="glass-dark p-4 rounded-2xl space-y-4">
                <div>
                  <p className="text-white/40 text-xs font-bold mb-2">SKIN TONE</p>
                  <div className="flex gap-2 flex-wrap">
                    {SKINS.map(s => (
                      <button key={s} onClick={() => setSkin(s)}
                        className={`w-9 h-9 rounded-full border-2 transition-all ${skin === s ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ background: s }} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold mb-2">HAIR COLOR</p>
                  <div className="flex gap-2 flex-wrap">
                    {HAIRS.map(h => (
                      <button key={h} onClick={() => setHair(h)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${hair === h ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ background: h }} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-white/40 text-xs font-bold mb-2">OUTFIT</p>
                  <div className="grid grid-cols-3 gap-2">
                    {OUTFITS.map(o => (
                      <button key={o} onClick={() => setOutfit(o)}
                        className={`py-2 rounded-xl text-xs font-bold border capitalize transition-all
                          ${outfit === o ? 'border-purple-400 bg-purple-600/30 text-white' : 'border-white/10 bg-white/5 text-white/50'}`}>
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={() => setStep(2)}
                className="btn w-full bg-gradient-to-r from-purple-600 to-pink-600 py-3">
                Looking good! →
              </button>
            </div>
          )}

          {current === 'done' && (
            <div className="text-center space-y-5">
              <div className="text-6xl animate-float">🎉</div>
              <div>
                <h2 className="font-display text-3xl text-white">Ready, {playerName}!</h2>
                <p className="text-white/50 text-sm mt-2">
                  Click anywhere to walk.<br/>
                  Click NPCs to chat.<br/>
                  Click place signs to explore.
                </p>
              </div>
              <div className="glass-dark p-3 rounded-2xl text-xs text-white/40 text-left space-y-1">
                <p>🖱️ Click ground — your avatar walks there</p>
                <p>👥 Click NPC — start a conversation</p>
                <p>📍 Click place sign — enter &amp; do activities</p>
                <p>🤖 AI-powered NPCs with Groq</p>
              </div>
              <button onClick={finish}
                className="btn w-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 py-3.5 text-base">
                🌍 Enter Cartoon City!
              </button>
            </div>
          )}

          {step > 0 && current !== 'done' && (
            <button onClick={() => setStep(s => s - 1)}
              className="w-full text-white/30 text-sm hover:text-white/60 text-center transition-colors">
              ← Back
            </button>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer links */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-3 flex-wrap px-4">
        <Link to="/about-us" className="text-slate-700 hover:text-slate-500 transition-colors text-[10px] no-underline">About Us</Link>
        <span className="text-slate-800 text-[10px]">·</span>
        <Link to="/privacy-policy" className="text-slate-700 hover:text-slate-500 transition-colors text-[10px] no-underline">Privacy Policy</Link>
        <span className="text-slate-800 text-[10px]">·</span>
        <Link to="/terms-and-conditions" className="text-slate-700 hover:text-slate-500 transition-colors text-[10px] no-underline">Terms &amp; Conditions</Link>
      </div>
    </div>
  )
}
