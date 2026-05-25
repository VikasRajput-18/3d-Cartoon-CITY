import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { gameControls } from '@/lib/gameControls'
import { getDmCache, setDmCache, appendDmCache } from '@/lib/chatCache'

export default function DirectChat({ myId, myName, targetId, targetName, onClose }) {
  const cached = getDmCache(myId, targetId)
  const [messages, setMessages] = useState(cached ?? [])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(!cached)
  const bottomRef  = useRef()
  const seenIds    = useRef(new Set(cached ? cached.map(m => String(m.id)) : []))

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // Only fetch history if we have no cached messages
    if (!cached) {
      supabase
        .from('messages')
        .select('*')
        .eq('type', 'direct')
        .or(
          `and(uid.eq.${myId},receiver_id.eq.${targetId}),` +
          `and(uid.eq.${targetId},receiver_id.eq.${myId})`
        )
        .order('created_at', { ascending: true })
        .limit(50)
        .then(({ data }) => {
          if (data) {
            setMessages(data)
            setDmCache(myId, targetId, data)
            data.forEach(m => seenIds.current.add(String(m.id)))
          }
          setLoading(false)
        })
    }

    // postgres_changes: messages where I am the receiver
    const pgSub = supabase
      .channel(`dm-pg-${myId}-${targetId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `receiver_id=eq.${myId}`,
      }, ({ new: row }) => {
        if (row.uid !== targetId || row.type !== 'direct') return
        const key = String(row.id)
        if (seenIds.current.has(key)) return
        seenIds.current.add(key)
        setMessages(prev => {
          const next = [...prev, row]
          setDmCache(myId, targetId, next)
          return next
        })
      })
      .subscribe()

    // Broadcast channel for instant delivery when both players have DM open
    const dmCh = supabase
      .channel('dm-' + [myId, targetId].sort().join('-'))
      .on('broadcast', { event: 'dm_msg' }, ({ payload }) => {
        if (payload.from !== targetId) return
        const key = 'bc-' + payload.ts
        if (seenIds.current.has(key)) return
        seenIds.current.add(key)
        setMessages(prev => {
          const msg  = { id: key, uid: payload.from, name: payload.name, content: payload.text, type: 'direct' }
          const next = [...prev, msg]
          setDmCache(myId, targetId, next)
          return next
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(pgSub)
      supabase.removeChannel(dmCh)
      gameControls.enabled = true
    }
  }, [myId, targetId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = input.trim()
    if (!text || !supabase) return
    setInput('')
    const ts     = Date.now()
    const tempId = 'me-' + ts

    const newMsg = { id: tempId, uid: myId, name: myName, content: text, type: 'direct' }
    seenIds.current.add(tempId)
    setMessages(prev => {
      const next = [...prev, newMsg]
      setDmCache(myId, targetId, next)
      return next
    })

    // Broadcast for instant delivery
    supabase.channel('dm-' + [myId, targetId].sort().join('-')).send({
      type: 'broadcast', event: 'dm_msg',
      payload: { from: myId, name: myName, text, ts },
    })

    // Persist
    supabase.from('messages').insert({
      uid: myId, name: myName, content: text,
      type: 'direct', receiver_id: targetId,
    })
  }

  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 16, width: 300, zIndex: 60,
      background: 'rgba(8,4,20,0.96)',
      border: '1.5px solid rgba(96,165,250,0.4)',
      borderRadius: 12, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      fontFamily: 'Nunito, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(96,165,250,0.2)',
        background: 'rgba(96,165,250,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px #4ade80' }} />
          <span style={{ color: '#60a5fa', fontWeight: 800, fontSize: 13 }}>{targetName}</span>
          <span style={{ color: '#475569', fontSize: 10 }}>DM</span>
        </div>
        <button
          onClick={() => { gameControls.enabled = true; onClose() }}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
        >×</button>
      </div>

      {/* Messages */}
      <div style={{ height: 220, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {!supabase ? (
          <div style={{ color: '#f87171', fontSize: 11, textAlign: 'center', marginTop: 80 }}>
            Multiplayer not configured
          </div>
        ) : loading ? (
          <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 80 }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 80 }}>
            Say hi to {targetName}
          </div>
        ) : messages.map((m, i) => {
          const isMe = m.uid === myId
          return (
            <div key={m.id ?? i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <div style={{
                background: isMe ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)',
                border: '1px solid ' + (isMe ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'),
                borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '5px 10px', maxWidth: '80%',
              }}>
                {!isMe && (
                  <div style={{ color: '#60a5fa', fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{m.name}</div>
                )}
                <div style={{ color: '#e2e8f0', fontSize: 12 }}>{m.content}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {supabase && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(96,165,250,0.2)', display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => { gameControls.enabled = false }}
            onBlur={() => { gameControls.enabled = true }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
            placeholder={`Message ${targetName}…`}
            maxLength={200}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(96,165,250,0.2)', borderRadius: 8,
              color: '#e2e8f0', fontSize: 12, padding: '5px 10px',
              fontFamily: 'Nunito, sans-serif', outline: 'none',
            }}
          />
          <button
            onClick={send}
            style={{
              background: 'rgba(96,165,250,0.25)', border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: 8, padding: '5px 12px',
              color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              fontFamily: 'Nunito, sans-serif',
            }}
          >Send</button>
        </div>
      )}
    </div>
  )
}
