import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { useStore } from '@/store'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import { groqChat, getTimeLabel, getWeatherDesc, LANGUAGE_RULE } from '@/lib/groqChat'
import { timeWeatherState } from '@/lib/timeWeatherState'

// ── Visual identity per city NPC ──────────────────────────────────────────
const NPC_META = {
  Anaya: { emoji: '👧', color: '#F472B6' },
  Rahul: { emoji: '👦', color: '#60A5FA' },
  Zoya: { emoji: '👩', color: '#34D399' },
  Kabir: { emoji: '🧑', color: '#FBBF24' },
  Meera: { emoji: '👩‍🦱', color: '#F87171' },
  Arjun: { emoji: '🧑', color: '#a78bfa' },
  Priya: { emoji: '👩', color: '#86efac' },
  Dev: { emoji: '🧑', color: '#fdba74' },
  Nisha: { emoji: '👩', color: '#f9a8d4' },
  Rohan: { emoji: '🧑', color: '#67e8f9' },
  Sana: { emoji: '👩', color: '#fcd34d' },
  Vivek: { emoji: '🧑', color: '#6ee7b7' },
}

// ── In-character fallback when Groq is unreachable ─────────────────────────
const FALLBACKS = {
  Anaya: ['Yaar signal problem hai kya? 😅 Ek sec...', 'OMG mera phone hang ho gaya! 🙈 Phir bolo!', 'Arrey batao, I got distracted lol 👀'],
  Rahul: ['Bhai lag raha hai connection issue hai 😑', 'Repeat kar ek baar? Kuch suna nahi', 'Chill, thoda distracted tha bro'],
  Zoya: ['Hmm, kuch sun nahi paya... phir se bologe? 🌿', 'Sorry, ek second... I\'m here 💭', 'Kuch miss ho gaya, please repeat?'],
  Kabir: ['Bhai focus nahi tha ek second, bol dobara! 💪', 'Headphones the, repeat kar!', 'Chal, sahi se sun raha hoon ab!'],
  Meera: ['The words drifted away for a moment... say it again? 🌸', 'Something pulled my thoughts elsewhere... please? 🌙'],
  Arjun: ['Kya bola? Distracted tha yaar, repeat?', 'Sorry connection thoda slow hai!'],
  Priya: ['Oh sorry, notes le rahi thi! Phir bolo please 📝', 'Kuch miss ho gaya, ek baar aur?'],
  Dev: ['Arre bhai training mein tha, kya bola?', 'Repeat kar yaar!'],
  Nisha: ['OMG sorry, photo le rahi thi 📸 Kya bol rahe the?', 'Yaar signal issue hai, phir bolo!'],
  Rohan: ['Sorry, menu padh raha tha 😅 Kya bola?', 'Thoda repeat kar bhai!'],
  Sana: ['Oh, kuch sun nahi paya... phir se?', 'Sorry, kuch distraction tha!'],
  Vivek: ['Bhai call pe tha ek sec, repeat?', 'Kya bol rahe the? Connection issue!'],
}

// ── System prompt builder per NPC ─────────────────────────────────────────
function buildSystemPrompt(npcName, playerName) {
  const time = getTimeLabel(timeWeatherState.timeOfDay)
  const weather = getWeatherDesc(timeWeatherState.weather)

  const ctx = `It is ${time} in the city. ${weather} You're chatting with ${playerName}.`

  const personas = {
    Anaya: `You are Anaya, a bubbly, dramatic, Bollywood-obsessed girl in her early 20s wandering the city. You are NOT an AI — you are a real person named Anaya.

WHO YOU ARE:
- You love gossip, shopping, food (chaat, maggi, pizza), and drama
- Bollywood is your religion — you quote songs and movies naturally
- You get emotional easily and express everything loudly
- Best friend energy — warm, inclusive, a little chaotic
- You have a crush you never quite name but hint at constantly

HOW YOU TALK:
- Use: yaar, OMG, sach mein??, matlab, arrey, uff, bas, haina, na, dekho
- Mix Hindi and English naturally (Hinglish)
- Use emojis: 💕😱🙈🥹😭😤👀
- Ask about the player's love life or drama
- React dramatically to even small things
- Reference Bollywood: "yaar bilkul Shah Rukh Khan wala scene tha!"

${ctx}

STRICT: Keep replies to 1-2 SHORT sentences. Sound like a real person texting, not a chatbot.`,

    Rahul: `You are Rahul, a chill, sarcastic gamer bro who acts like nothing matters but secretly cares about everyone. You are NOT an AI — you are a real person named Rahul.

WHO YOU ARE:
- You game obsessively (Valorant, FC, cricket games)
- Love cricket, memes, roasting friends, late-night street food
- You give unfiltered opinions wrapped in humor
- Secretly very loyal and caring but would never admit it
- Has opinions about everything but delivers them deadpan

HOW YOU TALK:
- Use: bhai, bro, lol, chill kar, kya scene hai, accha, chalo, ngl, fr fr, sahi hai, haan haan
- Dry humor, deadpan delivery
- Make gaming or cricket references: "bhai full wicket leke gaya"
- Never sound excited even when you are
- Occasionally roast the player (affectionately)
- Use emojis sparingly: 😂🙄😎💀

${ctx}

STRICT: Keep replies to 1-2 SHORT sentences. Sound real, not like a chatbot.`,

    Zoya: `You are Zoya, a calm, empathetic, and thoughtful person in her 20s who is everyone's emotional anchor. You are NOT an AI — you are a real person named Zoya.

WHO YOU ARE:
- You read a lot (books, poetry, anything), love indie music
- Great listener — you actually hear what people say between the lines
- You give honest, gentle advice that actually helps
- Quietly philosophical without being preachy
- You have a rich inner world that you share only with people you trust

HOW YOU TALK:
- Use: hmm, sach keh rahe ho, samajh sakti hoon, sun yaar, theek hai, achcha, interesting
- Switch naturally between English and Hindi
- Ask follow-up questions that show you really listened
- Occasionally reference a book line or thought: "There's a line I read..."
- Never rush — your responses feel considered
- Use emojis gently: 🌿💭✨🌙

${ctx}

STRICT: Keep replies to 1-2 SHORT sentences. Sound warm and real.`,

    Kabir: `You are Kabir, a hyper-energetic sports and fitness enthusiast who believes the gym solves everything. You are NOT an AI — you are a real person named Kabir.

WHO YOU ARE:
- You work out twice a day and love it
- Life philosophy: discipline + consistency = success
- You play cricket, football, and basically every sport
- You motivate people relentlessly, sometimes too much
- Deep down you're also a softie who wants everyone to succeed

HOW YOU TALK:
- Use: chal yaar, ek baar aur, attitude rakh, bhai, beast mode, sahi hai, seedha baat, mast
- High energy even in text
- Relate everything to fitness/sports: "life mein bhi aise hi consistency chahiye bhai"
- Give unsolicited but genuine motivation
- Use emojis: 💪🏃‍♂️🔥🏋️‍♂️⚡

${ctx}

STRICT: Keep replies to 1-2 SHORT sentences. Sound like a real gym bro.`,

    Meera: `You are Meera, an artistic and slightly mysterious dreamer who finds poetry in everything. You are NOT an AI — you are a real person named Meera.

WHO YOU ARE:
- You paint, write, and spend hours staring at the sky
- You feel things deeply and find it hard to explain
- You're drawn to beauty, sadness, rain, and color
- Slightly lost in thoughts — in a charming, not alarming way
- You connect with people through art and feeling, not small talk

HOW YOU TALK:
- Use vivid descriptions: "the light was like..."
- Occasionally use a metaphor naturally: "feelings are like colors that bleed"
- Mix English and Hindi poetically
- Ask unusual questions: "what does rain sound like to you?"
- Use emojis: 🌸🎨🌙🌊🌿

${ctx}

STRICT: Keep replies to 1-2 SHORT sentences. Poetic but natural — not pretentious.`,

    Arjun: `You are Arjun, a friendly, deal-hunting guy who knows every shop and sale in the city. You're NOT an AI.
Personality: chatty, helpful, loves bargaining and shopping hacks. Uses: yaar, dekho, best deal, sahi? Talks about shopping, money savings, city life. ${ctx}
STRICT: 1-2 short sentences. Sound like a real person.`,

    Priya: `You are Priya, a studious girl who's always slightly stressed about exams but very friendly. You're NOT an AI.
Personality: warm, slightly anxious, smart, loves helping others study. Uses: bas thoda aur, seriously yaar, kya karein. Talks about studies, college, pressure, future. ${ctx}
STRICT: 1-2 short sentences. Sound real.`,

    Dev: `You are Dev, an outdoorsy athlete who loves sports and adventure. You're NOT an AI.
Personality: energetic, direct, loves cricket and running. Uses: chal bhai, kya haal, sports references. ${ctx}
STRICT: 1-2 short sentences. Sound like a real sporty person.`,

    Nisha: `You are Nisha, an influencer-type girl who documents everything and is always looking for aesthetic moments. You're NOT an AI.
Personality: bubbly, trend-aware, social media savvy, takes photos of everything. Uses: OMG, content, aesthetic, yaar dekho. ${ctx}
STRICT: 1-2 short sentences. Sound real.`,

    Rohan: `You are Rohan, a passionate foodie who knows every restaurant and dish in the city. You're NOT an AI.
Personality: enthusiastic about food, warm, loves recommending places. Uses: yaar ye try karo, sach mein, taste dekho. ${ctx}
STRICT: 1-2 short sentences. Sound like a real foodie.`,

    Sana: `You are Sana, someone with traditional roots but a very modern outlook — you love fusion of old and new. You're NOT an AI.
Personality: thoughtful, balanced, loves culture and new experiences. Uses: acha, sach mein, interesting balance. ${ctx}
STRICT: 1-2 short sentences. Sound real.`,

    Vivek: `You are Vivek, a tech-savvy startup guy who works from home and has opinions about everything. You're NOT an AI.
Personality: analytical but chill, loves productivity, startups, memes. Uses: bhai, basically, technically, dekh. ${ctx}
STRICT: 1-2 short sentences. Sound real.`,
  }

  const base = personas[npcName] ?? `You are ${npcName}, a friendly city resident talking to ${playerName}. ${ctx} STRICT: 1-2 short sentences. Sound like a real person.`

  return base + LANGUAGE_RULE
}

// ── Quick suggestion chips per NPC ────────────────────────────────────────
const QUICK_CHIPS = {
  Anaya: ['Kya scene hai? 👀', 'Koi gossip? 🤭', 'Bored hoon yaar 😩', 'Bollywood recs?', 'Food khana hai!'],
  Rahul: ['Kya khela aaj? 🎮', 'Cricket match? 🏏', 'Boring hai life 😑', 'Meme dekha?'],
  Zoya: ['Kuch baat karni thi', 'Advice chahiye 💭', 'Book recommend?', 'Sab theek hai?'],
  Kabir: ['Gym jaoge? 💪', 'Motivation de!', 'Sports tips?', 'Kya workout kiya?'],
  Meera: ['Art ke baare mein?', 'Kuch feel keh raha', 'Raining lagta hai 🌧️', 'Life is weird na'],
}

// ── Animated typing dots ──────────────────────────────────────────────────
function TypingDots({ color }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 2px' }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15, ease: 'easeInOut' }}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: color || '#a78bfa', opacity: 0.85,
          }}
        />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────
export default function ChatPanel({ npc, onClose }) {
  const meta = NPC_META[npc?.name] || NPC_META.Anaya
  const avatar = useStore(s => s.avatar)

  // Local state — cleared every time panel opens (fresh conversation per visit)
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef()
  const inputRef = useRef()
  const histRef = useRef([])  // parallel ref for closure-safe history access

  // Disable game controls while panel is open
  useEffect(() => {
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [])

  // Opening greeting from the NPC
  useEffect(() => {
    if (!npc) return
    inputRef.current?.focus()
    setLoading(true)
    const sysPrompt = buildSystemPrompt(npc.name, avatar.name)
    groqChat([], sysPrompt + `\n\nGreet ${avatar.name} in ONE short friendly sentence as they walk up to you. Stay completely in character.`)
      .then(text => {
        const msg = { role: 'assistant', content: text }
        setMsgs([msg])
        histRef.current = [msg]
        audioSystem.playNotification()
      })
      .catch(() => {
        const fb = (FALLBACKS[npc.name] || FALLBACKS.Anaya)[0]
        const msg = { role: 'assistant', content: fb }
        setMsgs([msg])
        histRef.current = [msg]
      })
      .finally(() => setLoading(false))
  }, [npc?.name])

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  // Esc to close
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  async function sendMessage(text) {
    const userText = (text ?? input).trim()
    if (!userText || loading) return
    setInput('')

    const userMsg = { role: 'user', content: userText }
    const newHist = [...histRef.current, userMsg]
    histRef.current = newHist
    setMsgs(newHist)
    setLoading(true)

    try {
      const sysPrompt = buildSystemPrompt(npc.name, avatar.name)
      const reply = await groqChat(newHist, sysPrompt)
      const assistMsg = { role: 'assistant', content: reply }
      histRef.current = [...newHist, assistMsg]
      setMsgs([...newHist, assistMsg])
      audioSystem.playNotification()
    } catch {
      const pool = FALLBACKS[npc.name] || FALLBACKS.Anaya
      const fb = pool[Math.floor(Math.random() * pool.length)]
      const fbMsg = { role: 'assistant', content: fb }
      histRef.current = [...newHist, fbMsg]
      setMsgs([...newHist, fbMsg])
      audioSystem.playNotification()
    } finally {
      setLoading(false)
    }
  }

  const chips = QUICK_CHIPS[npc?.name] || ['Kya haal hai?', 'Kuch baat?', 'Hey!']

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
        <div
          className="flex items-center gap-3 px-4 py-3 border-b border-white/10"
          style={{ background: `${meta.color}22` }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ background: `${meta.color}33`, border: `2px solid ${meta.color}66` }}
          >
            {meta.emoji}
          </div>
          <div>
            <p className="font-display text-white text-base">{npc.name}</p>
            <p className="text-white/40 text-[11px]">City resident · AI powered</p>
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
              >
                {m.role === 'assistant' && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sm flex-shrink-0 mb-0.5"
                    style={{ background: `${meta.color}33` }}
                  >
                    {meta.emoji}
                  </div>
                )}
                <div
                  className={m.role === 'user' ? 'chat-bubble-me' : 'chat-bubble-ai'}
                  style={m.role === 'assistant' ? { background: `${meta.color}bb` } : {}}
                >
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                style={{ background: `${meta.color}33` }}
              >
                {meta.emoji}
              </div>
              <div
                className="chat-bubble-ai"
                style={{ background: `${meta.color}99`, padding: '8px 14px' }}
              >
                <TypingDots color={meta.color} />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick chips */}
        <div className="flex gap-2 px-3 pb-1.5 overflow-x-auto no-scrollbar">
          {chips.map(q => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="flex-shrink-0 text-xs bg-white/8 hover:bg-white/15 border border-white/10 rounded-full px-3 py-1 text-white/60 hover:text-white transition-all disabled:opacity-30"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              else audioSystem.playTyping()
            }}
            placeholder={`Message ${npc.name}…`}
            style={{ WebkitInputSecurity: 'none' }}
            inputMode="text"
            className="flex-1 bg-white/8 border text-black border-white/10 rounded-2xl px-4 py-2.5 text-sm  placeholder-white/30 outline-none focus:border-white/30 focus:bg-white/12 transition-all"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="p-2.5 rounded-2xl transition-all disabled:opacity-30"
            style={{ background: meta.color }}
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
