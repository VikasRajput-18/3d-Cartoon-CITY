// AI interview for a job application. Talks to Groq (role-played interviewer), asks
// 3 questions, then returns a JSON hiring decision. Falls back to a self-contained
// offline interview if Groq is unavailable, so the job loop always works.
import { useState, useEffect, useRef } from 'react'
import { groqChat } from '@/lib/groqChat'
import { hireForJob, recordRejection } from '@/lib/jobService'
import { gameControls } from '@/lib/gameControls'

function parseDecision(text) {
  if (!text) return null
  const a = text.indexOf('{'); const b = text.lastIndexOf('}')
  if (a === -1 || b === -1 || b < a) return null
  try {
    const obj = JSON.parse(text.slice(a, b + 1))
    if (typeof obj.hired === 'boolean' || typeof obj.score === 'number') {
      return {
        score: Math.round(obj.score ?? 0),
        hired: obj.hired ?? (obj.score >= 60),
        feedback: obj.feedback || (obj.hired ? 'Welcome aboard!' : 'Not this time.'),
        salary: obj.salary,
      }
    }
  } catch {}
  return null
}

const OFFLINE_QS = [
  'Tell me a little about yourself and why you want this role.',
  'Describe a time you handled a difficult situation. What did you do?',
  'Why should we hire you over other candidates?',
]

export default function InterviewPanel({ job, playerName, onClose, onHired }) {
  const [messages, setMessages] = useState([])   // { role:'assistant'|'user', content }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState(null)
  const offlineRef = useRef(false)
  const offlineCharsRef = useRef(0)
  const answersRef = useRef(0)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Disable ALL game controls while the interview modal is open, and ALWAYS
  // re-enable on close (unmount) so controls can never be left stuck off.
  useEffect(() => {
    gameControls.enabled = false
    return () => { gameControls.enabled = true }
  }, [])

  // Auto-focus the answer field once a question is on screen.
  useEffect(() => {
    if (!loading && !decision) inputRef.current?.focus()
  }, [loading, decision])

  const systemPrompt =
    `You are a professional interviewer for the position of "${job.title}" (${job.dept}) in Cartoon City. ` +
    `Ask EXACTLY 3 interview questions relevant to the job, ONE question per message, and wait for the candidate's answer each time. ` +
    `Base salary for this role is ${job.rate} coins/hour. ` +
    `After the candidate has answered all 3 questions, reply with ONLY a JSON object and nothing else: ` +
    `{"score": <0-100>, "feedback": "<short>", "hired": <true if score>=60 else false>, "salary": <base salary nudged up a little for higher scores>}. ` +
    `Be professional but friendly. Mix Hindi and English naturally (Hinglish).`

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, loading, decision])

  // Kick off the interview (Q1). Fall back to offline mode if Groq fails.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const q = await groqChat([{ role: 'user', content: '[The candidate sits down. Begin the interview with your first question.]' }], systemPrompt, 180)
        if (cancelled) return
        setMessages([{ role: 'assistant', content: q }])
      } catch {
        if (cancelled) return
        offlineRef.current = true
        setMessages([{ role: 'assistant', content: `Namaste ${playerName || ''}! Let's begin. ${OFFLINE_QS[0]}` }])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function send() {
    const text = input.trim()
    if (!text || loading || decision) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    answersRef.current += 1
    offlineCharsRef.current += text.length

    // ── Offline interview path ──
    if (offlineRef.current) {
      setTimeout(() => {
        if (answersRef.current < 3) {
          setMessages(m => [...m, { role: 'assistant', content: OFFLINE_QS[answersRef.current] }])
        } else {
          const score = Math.max(0, Math.min(100, 45 + Math.round(offlineCharsRef.current / 4)))
          const hired = score >= 60
          finalize({ score, hired, feedback: hired ? 'Solid answers — welcome to the team!' : 'Give more detail next time. Try again in 24h.', salary: job.rate + (score >= 85 ? 2 : score >= 70 ? 1 : 0) }, next)
        }
        setLoading(false)
      }, 500)
      return
    }

    // ── Groq path ──
    try {
      let reply = await groqChat(next, systemPrompt, 200)
      let dec = parseDecision(reply)
      if (!dec && answersRef.current >= 3) {
        // Nudge for the JSON decision once.
        const reply2 = await groqChat([...next, { role: 'assistant', content: reply }, { role: 'user', content: '[Please share your final decision now as the JSON object only.]' }], systemPrompt, 160)
        dec = parseDecision(reply2)
        if (!dec) reply = reply2
      }
      if (dec) { finalize(dec, next); setLoading(false); return }
      setMessages(m => [...m, { role: 'assistant', content: reply }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '(The interviewer had a connection hiccup — please resend your answer.)' }])
      answersRef.current = Math.max(0, answersRef.current - 1)
    }
    setLoading(false)
  }

  async function finalize(dec, transcript) {
    setDecision(dec)
    setMessages(m => [...m, { role: 'assistant', content: dec.hired ? `🎉 ${dec.feedback}` : `${dec.feedback}` }])
    if (dec.hired) {
      const res = await hireForJob(job.id, dec.salary ?? job.rate, dec.score, transcript)
      setTimeout(() => onHired?.(res.salary ?? job.rate, dec.score), 1400)
    } else {
      recordRejection(job.id, dec.score, transcript)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Nunito, sans-serif' }}>
      <div style={{ width: 'min(94vw, 460px)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#0f172a', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 26 }}>{job.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>{job.title} Interview</div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Cartoon City HR · {job.dept}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%',
              background: m.role === 'user' ? '#2563eb' : '#1e293b', color: '#fff',
              padding: '8px 12px', borderRadius: 12, fontSize: 14, lineHeight: 1.35 }}>
              {m.content}
            </div>
          ))}
          {loading && <div style={{ alignSelf: 'flex-start', color: '#64748b', fontSize: 13 }}>interviewer is typing…</div>}
        </div>

        {/* Decision footer or input */}
        {decision ? (
          <div style={{ padding: 14, borderTop: '1px solid #1e293b', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: decision.hired ? '#34d399' : '#f87171' }}>
              {decision.hired ? `Hired! Score ${decision.score}/100` : `Not hired · Score ${decision.score}/100`}
            </div>
            {decision.hired && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Starting salary: {decision.salary ?? job.rate} coins/hr</div>}
            {!decision.hired && (
              <button onClick={onClose} style={{ marginTop: 10, background: '#334155', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 800, cursor: 'pointer' }}>Close</button>
            )}
          </div>
        ) : (
          <div style={{ padding: 10, borderTop: '1px solid #1e293b', display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onFocus={() => { gameControls.enabled = false }}
              onKeyDown={e => {
                e.stopPropagation()                       // don't let WASD/E/F reach the game
                if (e.key === 'Enter')  { e.preventDefault(); send() }
                else if (e.key === 'Escape') { e.preventDefault(); onClose() }
                // Tab falls through → normal focus movement within the panel
              }}
              onKeyUp={e => e.stopPropagation()}
              onKeyPress={e => e.stopPropagation()}
              placeholder="Type your answer…"
              disabled={loading}
              autoFocus
              style={{ flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '9px 12px', color: '#fff', fontSize: 14, outline: 'none' }}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '0 16px', fontWeight: 800, cursor: 'pointer', opacity: loading || !input.trim() ? 0.5 : 1 }}>
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
