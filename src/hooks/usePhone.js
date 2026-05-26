import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { audioSystem } from '@/lib/audioSystem'
import { groqChat, LANGUAGE_RULE } from '@/lib/groqChat'
import { timeWeatherState } from '@/lib/timeWeatherState'
import { spendCoins, getEconomyState } from '@/lib/economyState'
import { COSTS } from '@/lib/costs'

// ── NPC free message tracking ─────────────────────────────────────────────────
function _npcMsgKey(userId, npcName) {
  return `npc_msgs_${userId}_${npcName}_${new Date().toDateString()}`
}
function getNpcFreeUsed(userId, npcName) {
  try { return parseInt(localStorage.getItem(_npcMsgKey(userId, npcName)) || '0', 10) } catch { return 0 }
}
function incNpcFreeUsed(userId, npcName) {
  try { localStorage.setItem(_npcMsgKey(userId, npcName), String(getNpcFreeUsed(userId, npcName) + 1)) } catch {}
}

// Sanitize to valid PeerJS peer ID — alphanumeric only, max 50 chars
function sanitize(id) {
  return ('vcall' + String(id)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 50)
}

const MIC_OPTS = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
}

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

// Create and open a PeerJS peer, resolve when peer is open
function createPeer(peerId) {
  return new Promise((resolve, reject) => {
    import('peerjs').then(({ Peer }) => {
      const peer = new Peer(peerId, {
        host: '0.peerjs.com', port: 443, path: '/', secure: true,
      })
      peer.on('open', (id) => {
        console.log('[Phone] PeerJS open, id:', id)
        resolve(peer)
      })
      peer.on('error', (err) => {
        console.error('[Phone] PeerJS peer error:', err.type, err)
        reject(err)
      })
    }).catch(reject)
  })
}

export function usePhone({ userId, userName, onlinePlayers = [] }) {
  const [phoneOpen,     setPhoneOpen]     = useState(false)
  const [callStatus,    setCallStatus]    = useState('idle')
  // idle | outgoing | incoming | connecting | active | npc | ended
  const [callMeta,      setCallMeta]      = useState(null)
  const [callElapsed,   setCallElapsed]   = useState(0)
  const [callCost,      setCallCost]      = useState(0)
  const [lowCoins,      setLowCoins]      = useState(false)
  const [missedCalls,   setMissedCalls]   = useState([])
  const [npcSession,    setNpcSession]    = useState(null)
  const [npcTyping,     setNpcTyping]     = useState(false)
  const [npcFreeLeft,   setNpcFreeLeft]   = useState(COSTS.callFreeNPCMessages)
  const [micMuted,      setMicMuted]      = useState(false)
  const [callError,     setCallError]     = useState(null)

  const peerRef       = useRef(null)   // PeerJS Peer instance
  const connRef       = useRef(null)   // active MediaConnection
  const localStrmRef  = useRef(null)   // local mic stream
  const remoteAudRef  = useRef(null)   // HTML Audio for remote audio
  const timerRef      = useRef(null)   // setInterval handle for elapsed + cost
  const callMetaRef   = useRef(null)   // always up-to-date callMeta
  const isCallerRef   = useRef(false)  // true when I initiated the call
  const callCostRef   = useRef(0)      // running call cost (coins)

  useEffect(() => { callMetaRef.current = callMeta }, [callMeta])

  // ── Helpers ────────────────────────────────────────────────────────────────
  const _startTimer = useCallback(() => {
    setCallElapsed(0)
    setCallCost(0)
    callCostRef.current = 0

    // Deduct initial connection cost
    spendCoins(COSTS.callPlayer)
    callCostRef.current = COSTS.callPlayer
    setCallCost(COSTS.callPlayer)

    let seconds = 0
    timerRef.current = setInterval(() => {
      seconds++
      setCallElapsed(s => s + 1)

      // Deduct per-minute cost every 60 seconds
      if (seconds % 60 === 0) {
        const eco = getEconomyState()
        if (eco.coins <= 0) {
          // Auto-end call — no coins left
          window.dispatchEvent(new CustomEvent('call-no-coins'))
          return
        }
        spendCoins(COSTS.callMinute)
        callCostRef.current += COSTS.callMinute
        setCallCost(callCostRef.current)

        // Warn when low
        const afterSpend = getEconomyState()
        if (afterSpend.coins < 30) {
          setLowCoins(true)
        }
      }
    }, 1000)
  }, [])

  const _stopTimer = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    setLowCoins(false)
  }, [])

  const _getMic = useCallback(async () => {
    if (localStrmRef.current) return localStrmRef.current
    console.log('[Phone] Requesting microphone...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia(MIC_OPTS)
      localStrmRef.current = stream
      console.log('[Phone] Microphone obtained')
      return stream
    } catch (err) {
      console.error('[Phone] Mic permission denied:', err)
      setCallError('Microphone access needed for calls')
      return null
    }
  }, [])

  const _attachRemote = useCallback((stream) => {
    console.log('[Phone] PeerJS call connected, attaching audio')
    let el = remoteAudRef.current
    if (!el) {
      el = new Audio()
      el.autoplay = true
      remoteAudRef.current = el
    }
    el.srcObject = stream
    el.play().catch(e => console.warn('[Phone] Audio autoplay blocked:', e))
  }, [])

  // Get or create the PeerJS peer (lazy, one per session)
  const _ensurePeer = useCallback(async () => {
    const existing = peerRef.current
    if (existing && !existing.destroyed && !existing.disconnected) return existing
    if (existing && !existing.destroyed) {
      existing.destroy()
      peerRef.current = null
    }
    const pid = sanitize(userId)
    console.log('[Phone] Initializing PeerJS peer:', pid)
    try {
      const peer = await createPeer(pid)
      peerRef.current = peer
      peer.on('disconnected', () => {
        console.log('[Phone] PeerJS disconnected, reconnecting...')
        try { peer.reconnect() } catch (_) {}
      })
      return peer
    } catch (err) {
      console.error('[Phone] Failed to create PeerJS peer:', err)
      return null
    }
  }, [userId])

  // Core hang-up: tears down audio, peer connection, Supabase row
  const _hangUp = useCallback((updateDb = true) => {
    console.log('[Phone] Call ended')
    audioSystem.stopRingtone()
    window.speechSynthesis?.cancel()
    _stopTimer()
    isCallerRef.current = false

    if (connRef.current) {
      try { connRef.current.close() } catch (_) {}
      connRef.current = null
    }
    if (localStrmRef.current) {
      localStrmRef.current.getTracks().forEach(t => t.stop())
      localStrmRef.current = null
    }
    if (remoteAudRef.current) {
      remoteAudRef.current.srcObject = null
      remoteAudRef.current = null
    }

    if (updateDb && supabase && callMetaRef.current?.callId) {
      supabase.from('calls')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', callMetaRef.current.callId)
        .then(() => {})
    }

    setCallStatus('ended')
    setTimeout(() => {
      setCallStatus('idle')
      setCallMeta(null)
      setCallElapsed(0)
      setCallCost(0)
      callCostRef.current = 0
      setLowCoins(false)
      setNpcSession(null)
      setNpcTyping(false)
      setNpcFreeLeft(COSTS.callFreeNPCMessages)
      setMicMuted(false)
      setCallError(null)
    }, 2000)
  }, [_stopTimer])

  // ── STEP 4: Caller makes the WebRTC call after receiver accepted ───────────
  const _makeWebRTCCall = useCallback(async () => {
    const meta = callMetaRef.current
    if (!meta) return

    const peer = await _ensurePeer()
    if (!peer) {
      setCallError('Could not connect voice, try again')
      _hangUp(true)
      return
    }

    const stream = await _getMic()
    if (!stream) {
      _hangUp(true)
      return
    }

    const receiverPid = sanitize(meta.receiverId)
    console.log('[Phone] Making PeerJS call to', receiverPid)

    let call
    try {
      call = peer.call(receiverPid, stream)
    } catch (err) {
      console.error('[Phone] peer.call() threw:', err)
      setCallError('Could not connect voice, try again')
      _hangUp(true)
      return
    }

    if (!call) {
      console.error('[Phone] peer.call() returned null')
      setCallError('Could not connect voice, try again')
      _hangUp(true)
      return
    }

    connRef.current = call

    // Timeout if no stream within 10s
    const timeout = setTimeout(() => {
      console.error('[Phone] PeerJS stream timeout')
      setCallError('Could not connect voice, try again')
      _hangUp(true)
    }, 10000)

    call.on('stream', (remoteStream) => {
      clearTimeout(timeout)
      _attachRemote(remoteStream)
      setCallStatus('active')
      _startTimer()
      if (supabase && meta.callId) {
        supabase.from('calls')
          .update({ status: 'active', answered_at: new Date().toISOString() })
          .eq('id', meta.callId)
          .then(() => {})
      }
    })
    call.on('close', () => _hangUp(false))
    call.on('error', (err) => {
      console.error('[Phone] PeerJS call error:', err)
      clearTimeout(timeout)
      _hangUp(false)
    })
  }, [_ensurePeer, _getMic, _attachRemote, _startTimer, _hangUp])

  // ── Supabase: receiver subscription — incoming calls + remote hang-up ─────
  useEffect(() => {
    if (!supabase || !userId) return

    const sub = supabase
      .channel('ph-recv-' + userId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'calls',
        filter: `receiver_id=eq.${userId}`,
      }, ({ eventType, new: row }) => {
        console.log('[Phone] Receiver sub:', eventType, row?.status)

        if (eventType === 'INSERT' && row.status === 'ringing') {
          if (callMetaRef.current) return  // already in a call
          console.log('[Phone] Incoming call from', row.caller_name)
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

        if (eventType === 'UPDATE' && (row.status === 'ended' || row.status === 'declined')) {
          if (callMetaRef.current?.callId === row.id) _hangUp(false)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [userId, userName, _hangUp])

  // ── Supabase: caller subscription — watch for accepted / ended ────────────
  useEffect(() => {
    if (!supabase || !userId) return

    const sub = supabase
      .channel('ph-call-' + userId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'calls',
        filter: `caller_id=eq.${userId}`,
      }, ({ new: row }) => {
        console.log('[Phone] Caller sub update:', row?.status)

        // Receiver accepted — now we initiate the WebRTC leg
        if (row.status === 'accepted' && isCallerRef.current) {
          setCallStatus('connecting')
          // Small delay to let receiver's peer fully open before we call
          setTimeout(() => _makeWebRTCCall(), 800)
        }

        if (row.status === 'ended' || row.status === 'declined') {
          if (callMetaRef.current?.callId === row.id) _hangUp(false)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(sub) }
  }, [userId, _makeWebRTCCall, _hangUp])

  // Auto-end call when coin event fires
  useEffect(() => {
    const handler = () => { _hangUp(true) }
    window.addEventListener('call-no-coins', handler)
    return () => window.removeEventListener('call-no-coins', handler)
  }, [_hangUp])

  // ── STEP 1: Caller initiates call ─────────────────────────────────────────
  const makeCall = useCallback(async (targetId, targetName) => {
    if (callMetaRef.current) return
    if (!supabase || !userId) return

    // Check coin balance before initiating
    const eco = getEconomyState()
    if (eco.coins < COSTS.callPlayer) {
      setCallError(`Need ${COSTS.callPlayer} coins to call`)
      setTimeout(() => setCallError(null), 3000)
      return
    }

    console.log('[Phone] Call initiated to', targetName)

    const { data: row, error } = await supabase.from('calls').insert({
      caller_id:     userId,
      caller_name:   userName,
      receiver_id:   targetId,
      receiver_name: targetName,
      status:        'ringing',
    }).select().single()

    if (error || !row) {
      console.error('[Phone] Failed to insert call row:', error)
      return
    }

    isCallerRef.current = true
    const meta = {
      callId:       row.id,
      callerId:     userId,
      callerName:   userName,
      receiverId:   targetId,
      receiverName: targetName,
    }
    setCallMeta(meta)
    setCallStatus('outgoing')
  }, [userId, userName])

  // ── STEP 3: Receiver accepts ───────────────────────────────────────────────
  const acceptCall = useCallback(async () => {
    audioSystem.stopRingtone()
    const meta = callMetaRef.current
    if (!meta) return
    console.log('[Phone] Call accepted, requesting microphone')

    setCallStatus('connecting')

    // Get mic first — show error if denied
    const stream = await _getMic()
    if (!stream) {
      // Revert to incoming so they can try again (or just hang up)
      setCallStatus('idle')
      setCallMeta(null)
      return
    }

    // Initialize peer and start listening for the WebRTC call from caller
    console.log('[Phone] Microphone obtained, initializing peer')
    const peer = await _ensurePeer()
    if (!peer) {
      setCallError('Could not connect voice, try again')
      _hangUp(true)
      return
    }

    // Register the call handler BEFORE updating Supabase so the caller's call won't be missed
    const timeout = setTimeout(() => {
      console.error('[Phone] Timeout waiting for caller WebRTC connection')
      setCallError('Could not connect voice, try again')
      _hangUp(true)
    }, 15000)

    peer.on('call', (call) => {
      clearTimeout(timeout)
      console.log('[Phone] PeerJS call received, answering')
      // Remove this handler so it doesn't fire again
      peer.off('call')
      connRef.current = call
      call.answer(stream)

      call.on('stream', (remoteStream) => {
        _attachRemote(remoteStream)
        setCallStatus('active')
        _startTimer()
        if (supabase && meta.callId) {
          supabase.from('calls')
            .update({ status: 'active', answered_at: new Date().toISOString() })
            .eq('id', meta.callId)
            .then(() => {})
        }
      })
      call.on('close', () => _hangUp(false))
      call.on('error', (err) => {
        console.error('[Phone] PeerJS call error on receiver:', err)
        _hangUp(false)
      })
    })

    // Now tell the caller we're ready — this triggers _makeWebRTCCall on their side
    console.log('[Phone] Updating Supabase to accepted')
    if (supabase) {
      await supabase.from('calls')
        .update({ status: 'accepted' })
        .eq('id', meta.callId)
    }
  }, [_getMic, _ensurePeer, _attachRemote, _startTimer, _hangUp])

  // ── Receiver rejects ───────────────────────────────────────────────────────
  const rejectCall = useCallback(() => {
    audioSystem.stopRingtone()
    const meta = callMetaRef.current
    if (meta?.callId && supabase) {
      supabase.from('calls')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', meta.callId)
        .then(() => {})
    }
    if (meta?.callerName) {
      setMissedCalls(prev => [
        { name: meta.callerName, id: meta.callerId, ts: Date.now() },
        ...prev.slice(0, 19),
      ])
    }
    _hangUp(false)
  }, [_hangUp])

  const endCall = useCallback(() => { _hangUp(true) }, [_hangUp])

  const toggleMic = useCallback(() => {
    if (!localStrmRef.current) return
    const muted = !micMuted
    localStrmRef.current.getAudioTracks().forEach(t => { t.enabled = !muted })
    setMicMuted(muted)
  }, [micMuted])

  // ── NPC call (AI + TTS, no WebRTC) ────────────────────────────────────────
  const callNPC = useCallback((npcName) => {
    if (callMetaRef.current) return
    setCallStatus('npc')
    setCallMeta({ callerId: userId, callerName: userName, receiverName: npcName })
    setNpcSession({ name: npcName, messages: [] })
    setNpcFreeLeft(Math.max(0, COSTS.callFreeNPCMessages - getNpcFreeUsed(userId, npcName)))
    audioSystem.playRingtone()
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

    const used = getNpcFreeUsed(userId, npcSession.name)
    const freeLeft = Math.max(0, COSTS.callFreeNPCMessages - used)

    if (freeLeft === 0) {
      // Paid message — check coins
      const eco = getEconomyState()
      if (eco.coins < COSTS.chatNPCExtra) {
        setNpcSession(s => ({ ...s, messages: [...s.messages, {
          role: 'npc', text: `[Not enough coins — need ${COSTS.chatNPCExtra} coins per message]`,
        }] }))
        return
      }
      spendCoins(COSTS.chatNPCExtra)
    } else {
      incNpcFreeUsed(userId, npcSession.name)
      setNpcFreeLeft(Math.max(0, freeLeft - 1))
    }

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
      setNpcSession(s => ({ ...s, messages: [...s.messages, { role: 'npc', text: 'Sorry, bad signal…' }] }))
    } finally {
      setNpcTyping(false)
    }
  }, [npcSession, userId])

  const clearMissed = useCallback((id) => {
    setMissedCalls(prev => prev.filter(m => m.id !== id && m.name !== id))
  }, [])

  return {
    phoneOpen, setPhoneOpen,
    callStatus, callMeta, callElapsed, callCost, lowCoins, callError,
    missedCalls, clearMissed,
    npcSession, npcTyping, npcFreeLeft, micMuted,
    makeCall, acceptCall, rejectCall, endCall, toggleMic,
    callNPC, sendNpcMessage,
  }
}
