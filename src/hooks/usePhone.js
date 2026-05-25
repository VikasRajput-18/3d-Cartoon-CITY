import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { sanitizePeerId } from '@/hooks/useVoiceChat'
import { audioSystem } from '@/lib/audioSystem'
import { groqChat, LANGUAGE_RULE } from '@/lib/groqChat'
import { timeWeatherState } from '@/lib/timeWeatherState'

// NPC voice configs for SpeechSynthesis
const NPC_VOICES = {
  Anaya:  { pitch: 1.45, rate: 1.05 },
  Rahul:  { pitch: 0.72, rate: 0.90 },
  Zoya:   { pitch: 1.10, rate: 0.90 },
  Kabir:  { pitch: 0.80, rate: 0.95 },
  Meera:  { pitch: 1.30, rate: 1.00 },
  Arjun:  { pitch: 0.68, rate: 0.85 },
  Priya:  { pitch: 1.20, rate: 1.05 },
  Dev:    { pitch: 0.85, rate: 0.90 },
  Nisha:  { pitch: 1.40, rate: 1.00 },
  Rohan:  { pitch: 0.90, rate: 0.95 },
  Sana:   { pitch: 1.25, rate: 1.00 },
  Vivek:  { pitch: 0.75, rate: 0.88 },
}

function npcSystemPrompt(npcName) {
  const hour = timeWeatherState.timeOfDay ?? 12
  return `You are ${npcName}, a friendly city resident in a 3D open-world game.
The player is calling you on the phone. Keep replies SHORT (1-2 sentences max).
Current time: ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'}.
Be warm, casual, and in-character. No asterisks, no actions, no emojis.
${LANGUAGE_RULE}`
}

function speakNpc(text, npcName) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  const cfg = NPC_VOICES[npcName] || { pitch: 1.0, rate: 1.0 }
  utt.pitch = cfg.pitch
  utt.rate  = cfg.rate
  utt.volume = 0.9
  window.speechSynthesis.speak(utt)
}

export function usePhone({ userId, userName, onlinePlayers = [] }) {
  const [phoneOpen,    setPhoneOpen]    = useState(false)
  const [callStatus,   setCallStatus]   = useState('idle')    // idle|outgoing|incoming|active|npc
  const [callMeta,     setCallMeta]     = useState(null)      // { callId, callerId, callerName, receiverId, receiverName }
  const [callElapsed,  setCallElapsed]  = useState(0)
  const [missedCalls,  setMissedCalls]  = useState([])
  const [npcSession,   setNpcSession]   = useState(null)      // { name, messages: [] }
  const [npcTyping,    setNpcTyping]    = useState(false)
  const [micMuted,     setMicMuted]     = useState(false)

  const peerRef      = useRef(null)
  const connRef      = useRef(null)   // active MediaConnection
  const remoteAudRef = useRef(null)
  const localStrmRef = useRef(null)
  const elapsedTmrRef= useRef(null)
  const pgSubRef     = useRef(null)
  const callMetaRef  = useRef(null)
  useEffect(() => { callMetaRef.current = callMeta }, [callMeta])

  // ── PeerJS init (separate peer from voice chat) ───────────────────────────
  useEffect(() => {
    if (!userId) return
    const pid = 'phone-' + sanitizePeerId(userId)
    import('peerjs').then(({ Peer }) => {
      const peer = new Peer(pid, { debug: 0 })
      peerRef.current = peer

      peer.on('call', (call) => {
        // Only accept if we are idle — otherwise reject silently
        if (callMetaRef.current) { call.close(); return }
        // We parse meta from the call.metadata object
        const meta = call.metadata || {}
        connRef.current = call
        setCallStatus('incoming')
        setCallMeta({
          callId:       meta.callId,
          callerId:     meta.callerId,
          callerName:   meta.callerName,
          receiverId:   userId,
          receiverName: userName,
        })
        audioSystem.playRingtone()
        if (navigator.vibrate) navigator.vibrate([300, 200, 300])
      })
    }).catch(() => {})

    return () => {
      peerRef.current?.destroy()
      peerRef.current = null
    }
  }, [userId, userName])

  // ── Supabase signaling subscription ──────────────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return
    const sub = supabase
      .channel('phone-calls-' + userId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'calls',
        filter: `receiver_id=eq.${userId}`,
      }, ({ eventType, new: row }) => {
        if (eventType === 'INSERT' && row.status === 'ringing') {
          // Incoming call signal from Supabase (fallback if PeerJS not yet connected)
          if (!callMetaRef.current) {
            setCallStatus('incoming')
            setCallMeta({
              callId:       row.id,
              callerId:     row.caller_id,
              callerName:   row.caller_name,
              receiverId:   userId,
              receiverName: userName,
            })
            audioSystem.playRingtone()
            if (navigator.vibrate) navigator.vibrate([300, 200, 300])
          }
        }
        if (eventType === 'UPDATE' && row.status === 'ended') {
          _hangUp(false)
        }
        if (eventType === 'UPDATE' && row.status === 'declined') {
          _hangUp(false)
        }
      })
      .subscribe()
    pgSubRef.current = sub
    return () => { supabase.removeChannel(sub) }
  }, [userId, userName])

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  const _startTimer = useCallback(() => {
    setCallElapsed(0)
    elapsedTmrRef.current = setInterval(() => setCallElapsed(s => s + 1), 1000)
  }, [])

  const _stopTimer = useCallback(() => {
    clearInterval(elapsedTmrRef.current)
    elapsedTmrRef.current = null
  }, [])

  // ── Get local mic stream ──────────────────────────────────────────────────
  const _getLocalStream = useCallback(async () => {
    if (localStrmRef.current) return localStrmRef.current
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      localStrmRef.current = s
      return s
    } catch (_) { return null }
  }, [])

  // ── Attach remote stream to audio ─────────────────────────────────────────
  const _attachRemote = useCallback((stream) => {
    if (!remoteAudRef.current) {
      remoteAudRef.current = new Audio()
      remoteAudRef.current.autoplay = true
    }
    remoteAudRef.current.srcObject = stream
  }, [])

  // ── Internal hang-up (cleans up connections) ──────────────────────────────
  const _hangUp = useCallback((updateSupabase = true) => {
    audioSystem.stopRingtone()
    _stopTimer()
    window.speechSynthesis?.cancel()

    if (connRef.current) { try { connRef.current.close() } catch (_) {} }
    connRef.current = null
    if (localStrmRef.current) {
      localStrmRef.current.getTracks().forEach(t => t.stop())
      localStrmRef.current = null
    }
    if (remoteAudRef.current) {
      remoteAudRef.current.srcObject = null
    }

    if (updateSupabase && supabase && callMetaRef.current?.callId) {
      supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callMetaRef.current.callId).then(() => {})
    }

    setCallStatus('idle')
    setCallMeta(null)
    setCallElapsed(0)
    setNpcSession(null)
    setNpcTyping(false)
    setMicMuted(false)
  }, [_stopTimer])

  // ── Make call to online player ────────────────────────────────────────────
  const makeCall = useCallback(async (targetId, targetName) => {
    if (!peerRef.current || !supabase || !userId) return
    if (callMetaRef.current) return   // already in a call

    const stream = await _getLocalStream()
    if (!stream) return

    // Insert Supabase signaling row
    const { data: row } = await supabase.from('calls').insert({
      caller_id:     userId,
      caller_name:   userName,
      receiver_id:   targetId,
      receiver_name: targetName,
      status:        'ringing',
    }).select().single()

    const meta = {
      callId: row?.id, callerId: userId, callerName: userName,
      receiverId: targetId, receiverName: targetName,
    }
    setCallMeta(meta)
    setCallStatus('outgoing')

    // PeerJS call
    const targetPid = 'phone-' + sanitizePeerId(targetId)
    const call = peerRef.current.call(targetPid, stream, { metadata: meta })
    connRef.current = call

    call.on('stream', (remoteStream) => {
      _attachRemote(remoteStream)
      setCallStatus('active')
      _startTimer()
      if (row?.id) {
        supabase.from('calls').update({ status: 'active', answered_at: new Date().toISOString() })
          .eq('id', row.id).then(() => {})
      }
    })
    call.on('close', () => _hangUp(false))
    call.on('error', () => _hangUp(false))
  }, [userId, userName, _getLocalStream, _attachRemote, _startTimer, _hangUp])

  // ── Accept incoming call ──────────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    audioSystem.stopRingtone()
    const call = connRef.current
    if (!call) return

    const stream = await _getLocalStream()
    if (!stream) { _hangUp(); return }

    call.answer(stream)
    call.on('stream', (remoteStream) => {
      _attachRemote(remoteStream)
      setCallStatus('active')
      _startTimer()
      if (callMetaRef.current?.callId && supabase) {
        supabase.from('calls').update({ status: 'active', answered_at: new Date().toISOString() })
          .eq('id', callMetaRef.current.callId).then(() => {})
      }
    })
    call.on('close', () => _hangUp(false))
    call.on('error', () => _hangUp(false))
  }, [_getLocalStream, _attachRemote, _startTimer, _hangUp])

  // ── Reject incoming call ──────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    audioSystem.stopRingtone()
    if (callMetaRef.current?.callId && supabase) {
      supabase.from('calls').update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', callMetaRef.current.callId).then(() => {})
    }
    // Add to missed list for caller (we track it locally for receiver too)
    if (callMetaRef.current?.callerName) {
      setMissedCalls(prev => [
        { name: callMetaRef.current.callerName, id: callMetaRef.current.callerId, ts: Date.now() },
        ...prev.slice(0, 19),
      ])
    }
    _hangUp(false)
  }, [_hangUp])

  // ── End active call ───────────────────────────────────────────────────────
  const endCall = useCallback(() => { _hangUp(true) }, [_hangUp])

  // ── Toggle mic mute ───────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!localStrmRef.current) return
    const muted = !micMuted
    localStrmRef.current.getAudioTracks().forEach(t => { t.enabled = !muted })
    setMicMuted(muted)
  }, [micMuted])

  // ── NPC call ──────────────────────────────────────────────────────────────
  const callNPC = useCallback((npcName) => {
    if (callMetaRef.current) return
    setCallStatus('npc')
    setCallMeta({ callerId: userId, callerName: userName, receiverName: npcName })
    setNpcSession({ name: npcName, messages: [] })
    audioSystem.playRingtone()
    // 2-second fake ring then "NPC answers"
    setTimeout(() => {
      audioSystem.stopRingtone()
      setCallStatus('active')
      _startTimer()
      const greeting = `Hey! It's ${npcName}. What's up?`
      setNpcSession(s => ({ ...s, messages: [{ role: 'npc', text: greeting }] }))
      speakNpc(greeting, npcName)
    }, 2000)
  }, [userId, userName, _startTimer])

  const sendNpcMessage = useCallback(async (text) => {
    if (!npcSession) return
    const updated = [...npcSession.messages, { role: 'user', text }]
    setNpcSession(s => ({ ...s, messages: updated }))
    setNpcTyping(true)
    try {
      const groqMessages = updated.map(m => ({
        role: m.role === 'npc' ? 'assistant' : 'user',
        content: m.text,
      }))
      const reply = await groqChat(groqMessages, npcSystemPrompt(npcSession.name), 80)
      setNpcSession(s => ({ ...s, messages: [...s.messages, { role: 'npc', text: reply }] }))
      speakNpc(reply, npcSession.name)
    } catch (_) {
      setNpcSession(s => ({ ...s, messages: [...s.messages, { role: 'npc', text: 'Sorry, bad signal...' }] }))
    } finally {
      setNpcTyping(false)
    }
  }, [npcSession])

  const clearMissed = useCallback((id) => {
    setMissedCalls(prev => prev.filter(m => m.id !== id))
  }, [])

  return {
    phoneOpen, setPhoneOpen,
    callStatus,
    callMeta,
    callElapsed,
    missedCalls, clearMissed,
    npcSession,
    npcTyping,
    micMuted,
    makeCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    callNPC,
    sendNpcMessage,
  }
}
