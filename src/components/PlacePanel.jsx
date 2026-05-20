import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Zap } from 'lucide-react'
import { useStore } from '@/store'

const PLACE_DATA = {
  cafe:      { emoji: '☕', color: '#F59E0B', activities: ['Order a latte', 'Chat with someone', 'Overhear gossip', 'Take a selfie', 'Spill coffee 😬'] },
  arcade:    { emoji: '🕹️', color: '#7C3AED', activities: ['Play racing game', 'Challenge a stranger', 'Win jackpot', 'Rage quit 😤', 'Break the machine'] },
  beach:     { emoji: '🏖️', color: '#38BDF8', activities: ['Swim in the sea', 'Build sandcastle', 'Flirt with stranger', 'Dance in waves', 'Step on something 😭'] },
  rooftop:   { emoji: '🌙', color: '#6366F1', activities: ['Stargaze', 'Share a deep secret', 'Call someone you miss', 'Scream into the void', 'Write in diary'] },
  musicroom: { emoji: '🎵', color: '#EC4899', activities: ['Sing karaoke', 'DJ for the crowd', 'Start a rap battle', 'Play guitar', 'Forget the lyrics 😭'] },
  park:      { emoji: '🌳', color: '#22C55E', activities: ['Take a walk', 'Feed pigeons', 'Run into ex 😬', 'Have a picnic', 'Get chased by dog 😱'] },
}

export default function PlacePanel({ place, onClose }) {
  const data    = PLACE_DATA[place.id] || PLACE_DATA.cafe
  const avatar  = useStore(s => s.avatar)
  const { updateStats, addCoins, toast, setMood } = useStore()

  const [outcome, setOutcome]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [chosen, setChosen]     = useState(null)

  async function doActivity(act) {
    if (loading) return
    setChosen(act)
    setLoading(true)
    setOutcome(null)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          // 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a funny cartoon life story narrator for a game called Cartoon Life Universe.
Write a short, funny outcome for what happens when a character does an activity.
Rules:
- Exactly 2 sentences
- Use Hinglish naturally — yaar, arre, bhai, kya scene, sahi hai, arey
- Be dramatic and hilarious
- End with a mood: [mood:happy|sad|excited|angry|love|cool|sleepy]
- End with coins earned: [coins:15-60]
Example: "☕ Arre yaar, ${avatar.name} ordered a triple espresso and became a local legend! The whole cafe started clapping. [mood:excited][coins:35]"`,
          messages: [{ role: 'user', content: `${avatar.name} is at ${place.label}. They decided to: "${act}". Tell me what happened!` }]
        })
      })
      const d = await res.json()
      const text = d.content?.[0]?.text || ''
      parse(text, act)
    } catch {
      // Fallback without API
      const fallbacks = [
        `🎭 Arre yaar, ${avatar.name} tried "${act}" at the ${place.label} and honestly... it changed their life! The whole crowd was shook. [mood:excited][coins:28]`,
        `💥 ${avatar.name} ne "${act}" kiya at ${place.label} and it went COMPLETELY sideways! But like, in a fun way? [mood:happy][coins:22]`,
        `😂 Bhai, ${avatar.name} did "${act}" and now the whole city is talking. No regrets though. [mood:cool][coins:35]`,
      ]
      parse(fallbacks[Math.floor(Math.random() * fallbacks.length)], act)
    } finally {
      setLoading(false)
    }
  }

  function parse(text, act) {
    const moodM  = text.match(/\[mood:(\w+)\]/)
    const coinsM = text.match(/\[coins:(\d+)\]/)
    const mood   = moodM?.[1] || 'happy'
    const coins  = parseInt(coinsM?.[1] || '20')
    const clean  = text.replace(/\[mood:\w+\]/g,'').replace(/\[coins:\d+\]/g,'').trim()

    setMood(mood)
    addCoins(coins)
    updateStats({ fun: 10, social: 5 })
    setOutcome({ text: clean, coins, mood })
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="fixed bottom-20 left-0 right-0 max-w-sm mx-auto px-3 z-50"
    >
      <div className="glass-dark rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
          style={{ background: `${data.color}18` }}>
          <span className="text-2xl">{data.emoji}</span>
          <div>
            <p className="font-display text-white text-lg">{place.label}</p>
            <div className="flex items-center gap-1 text-green-400 text-xs">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span>12 people here</span>
            </div>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-xl hover:bg-white/10 transition-all">
            <X size={16} className="text-white/60" />
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          {/* Outcome */}
          <AnimatePresence>
            {outcome && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl p-3.5 border"
                style={{ background: `${data.color}18`, borderColor: `${data.color}44` }}
              >
                <p className="text-white text-sm leading-relaxed font-body">{outcome.text}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  <span className="text-xs bg-amber-500/20 border border-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                    +{outcome.coins} 🪙
                  </span>
                  <span className="text-xs text-white/40">mood: {outcome.mood}</span>
                  <button
                    onClick={() => doActivity(chosen)}
                    className="ml-auto flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full transition-all"
                    style={{ background: `${data.color}33`, color: data.color }}
                  >
                    <Zap size={10} /> What next?
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Activity list */}
          <p className="text-white/40 text-xs font-bold px-1">WHAT DO YOU WANT TO DO?</p>
          <div className="space-y-1.5">
            {data.activities.map(act => (
              <button
                key={act}
                onClick={() => doActivity(act)}
                disabled={loading}
                className={`w-full text-left px-4 py-2.5 rounded-2xl border text-sm font-bold transition-all
                  flex items-center justify-between group
                  ${loading ? 'opacity-40 cursor-not-allowed' : 'hover:border-white/20 hover:bg-white/8 active:scale-[0.98]'}
                  ${chosen === act && loading ? 'border-white/20 bg-white/10' : 'border-white/8 bg-white/4'}
                `}
              >
                <span className="text-white/80 group-hover:text-white transition-colors">{act}</span>
                {chosen === act && loading
                  ? <Loader2 size={14} className="animate-spin text-white/60" />
                  : <span className="text-white/20 group-hover:text-white/50">→</span>
                }
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
