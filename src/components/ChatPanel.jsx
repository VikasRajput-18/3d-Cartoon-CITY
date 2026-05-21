import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Loader2 } from 'lucide-react'
import { useStore } from '@/store'
import { gameControls } from '@/lib/gameControls'

const NPC_PERSONAS = {
  Anaya: {
    emoji: '👧',
    color: '#F472B6',
    vibe: 'bubbly, warm, loves drama and gossip, uses a lot of "yaar" and "OMG", very emotional',
    intro: 'Heyyyy! Kya haal hai? 😊',
  },
  Rahul: {
    emoji: '👦',
    color: '#60A5FA',
    vibe: 'chill bro, sarcastic, loves gaming and memes, says "bhai" a lot, never takes anything seriously',
    intro: 'Oh hey! Kya scene hai bhai? 😎',
  },
  Zoya: {
    emoji: '👩',
    color: '#34D399',
    vibe: 'smart, kind, gives good advice, calm, loves books and music, switches between English and Hindi naturally',
    intro: 'Hi there! Sab theek? 🌿',
  },
  Kabir: {
    emoji: '🧑',
    color: '#FBBF24',
    vibe: 'sporty, energetic, always talking about fitness and sports, motivational, uses "chal yaar" often',
    intro: 'Arre yaar! Ready for some action? 💪',
  },
  Meera: {
    emoji: '👩‍🦱',
    color: '#F87171',
    vibe: 'artistic and creative, mysterious, talks about feelings and dreams, uses poetic language sometimes',
    intro: 'Oh, hello... I was just thinking about you. 🌸',
  },
}

export default function ChatPanel({ npc, onClose }) {
  const persona = NPC_PERSONAS[npc?.name] || NPC_PERSONAS.Anaya
  const avatar  = useStore(s => s.avatar)
  const chatHistory = useStore(s => s.chatHistory)
  const { addMessage, toast } = useStore()

  const msgs     = chatHistory[npc?.name] || []
  const [input, setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()

  // Disable game controls while this panel is mounted
  useEffect(() => {
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [])

  // Auto-intro on first open
  useEffect(() => {
    if (msgs.length === 0) {
      addMessage(npc.name, { role: 'assistant', text: persona.intro })
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userText = input.trim()
    setInput('')
    addMessage(npc.name, { role: 'user', text: userText })
    setLoading(true)

    try {
      // Build conversation for Claude
      const history = [...msgs, { role: 'user', text: userText }]
      const messages = history.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.role === 'user' ? m.text : m.text
      }))

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          // Add your key here or via env
          // 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are ${npc.name}, a cartoon character in a social game called "Cartoon Life Universe".
Your personality: ${persona.vibe}.
You are talking to ${avatar.name}, a player in the game.
Rules:
- Keep responses SHORT — 1 to 3 sentences max
- Use Hinglish naturally (mix Hindi words like yaar, arre, bas, sahi, bhai, kya scene, accha etc with English)
- Stay in character always — you ARE ${npc.name}, not an AI
- Be warm, funny, and engaging
- React to what the player says emotionally
- Sometimes ask a question back
- Use emojis naturally`,
          messages,
        })
      })

      const data = await res.json()
      const reply = data.content?.[0]?.text

      if (reply) {
        addMessage(npc.name, { role: 'assistant', text: reply })
      } else {
        throw new Error('No reply')
      }
    } catch (err) {
      // Fallback responses
      const fallbacks = {
        Anaya: ["OMG yaar, that's so interesting! 😱", "Haan haan! Mujhe bhi aisa lagta hai 💕", "Sach mein?? Tell me more babes! 👀"],
        Rahul: ["Bhai seriously? 😂", "Lol that's actually kinda valid ngl", "Chal yaar, let's not overthink it 😎"],
        Zoya:  ["Hmm, that's a really interesting perspective 🌿", "I think I understand what you mean... 💭", "Have you tried looking at it differently? ✨"],
        Kabir: ["Arre chal yaar! We got this! 💪", "Bhai gym jaate hain tension khatam 😂", "Energy hi sab kuch hai life mein! 🏋️"],
        Meera: ["There's something beautiful in what you said... 🌸", "Feelings are like paintings — never quite finished 🎨", "I hear you... 🌙"],
      }
      const f = fallbacks[npc.name] || fallbacks.Anaya
      addMessage(npc.name, { role: 'assistant', text: f[Math.floor(Math.random() * f.length)] })
      // Only toast if it's not an auth issue (expected without API key)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="fixed bottom-20 left-0 right-0 max-w-sm mx-auto px-3 z-50"
    >
      <div className="glass-dark rounded-3xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
          style={{ background: `${persona.color}22` }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ background: `${persona.color}33`, border: `2px solid ${persona.color}66` }}>
            {persona.emoji}
          </div>
          <div>
            <p className="font-display text-white text-base">{npc.name}</p>
            <p className="text-white/40 text-[11px]">Cartoon City resident · AI</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-white/10 transition-all">
              <X size={16} className="text-white/60" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="px-3 py-3 h-64 overflow-y-auto space-y-2.5 scroll-smooth">
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
              >
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0 mb-0.5"
                    style={{ background: `${persona.color}33` }}>
                    {persona.emoji}
                  </div>
                )}
                <div className={m.role === 'user' ? 'chat-bubble-me' : 'chat-bubble-ai'}
                  style={m.role === 'assistant' ? { background: `${persona.color}99` } : {}}>
                  {m.text}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                style={{ background: `${persona.color}33` }}>{persona.emoji}</div>
              <div className="chat-bubble-ai flex items-center gap-2" style={{ background: `${persona.color}99` }}>
                <Loader2 size={12} className="animate-spin" />
                <span className="text-white/70 text-xs">typing...</span>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick reactions */}
        <div className="flex gap-2 px-3 pb-1.5 overflow-x-auto no-scrollbar">
          {['👋 Heyyy!', '😂 LOL', '💕 Aww', '🤔 Really?', '🎮 Wanna play?', '☕ Coffee?'].map(q => (
            <button
              key={q}
              onClick={() => { setInput(q.split(' ').slice(1).join(' ') || q) }}
              className="flex-shrink-0 text-xs bg-white/8 hover:bg-white/15 border border-white/10 rounded-full px-3 py-1 text-white/60 hover:text-white transition-all"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={`Message ${npc.name}...`}
            className="flex-1 bg-white/8 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/12 transition-all"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-2xl transition-all disabled:opacity-30"
            style={{ background: persona.color }}
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
