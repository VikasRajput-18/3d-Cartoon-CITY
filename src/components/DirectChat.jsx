import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { gameControls } from '@/lib/gameControls'
import { getDmCache, setDmCache, appendDmCache } from '@/lib/chatCache'
import { audioSystem } from '@/lib/audioSystem'

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
    audioSystem.playChatSent()
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
    <div
      className="fixed bottom-[90px] right-4 w-[300px] z-[60] rounded-xl overflow-hidden flex flex-col font-body"
      style={{
        background: 'rgba(8,4,20,0.96)',
        border: '1.5px solid rgba(96,165,250,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 flex items-center justify-between"
        style={{
          borderBottom: '1px solid rgba(96,165,250,0.2)',
          background: 'rgba(96,165,250,0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: '#4ade80', boxShadow: '0 0 4px #4ade80' }}
          />
          <span className="text-blue-400 font-extrabold text-[13px]">{targetName}</span>
          <span className="text-slate-600 text-[10px]">DM</span>
        </div>
        <button
          onClick={() => { gameControls.enabled = true; onClose() }}
          className="bg-transparent border-0 text-slate-500 cursor-pointer text-lg leading-none"
        >×</button>
      </div>

      {/* Messages */}
      <div className="h-[220px] overflow-y-auto px-3 py-2 flex flex-col gap-[5px]">
        {!supabase ? (
          <div className="text-red-400 text-[11px] text-center mt-20">
            Multiplayer not configured
          </div>
        ) : loading ? (
          <div className="text-slate-600 text-[11px] text-center mt-20">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="text-slate-600 text-[11px] text-center mt-20">
            Say hi to {targetName}
          </div>
        ) : messages.map((m, i) => {
          const isMe = m.uid === myId
          return (
            <div key={m.id ?? i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div style={{
                background: isMe ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.07)',
                border: '1px solid ' + (isMe ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'),
                borderRadius: isMe ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '5px 10px', maxWidth: '80%',
              }}>
                {!isMe && (
                  <div className="text-blue-400 text-[10px] font-bold mb-0.5">{m.name}</div>
                )}
                <div className="text-slate-200 text-xs">{m.content}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {supabase && (
        <div
          className="px-2.5 py-2 flex gap-1.5"
          style={{ borderTop: '1px solid rgba(96,165,250,0.2)' }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => { gameControls.enabled = false }}
            onBlur={() => { gameControls.enabled = true }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
            placeholder={`Message ${targetName}…`}
            maxLength={200}
            className="flex-1 rounded-lg text-slate-200 text-xs font-body outline-none py-[5px] px-2.5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(96,165,250,0.2)',
            }}
          />
          <button
            onClick={send}
            className="rounded-lg py-[5px] px-3 text-white font-bold text-xs cursor-pointer font-body"
            style={{
              background: 'rgba(96,165,250,0.25)',
              border: '1px solid rgba(96,165,250,0.4)',
            }}
          >Send</button>
        </div>
      )}
    </div>
  )
}
