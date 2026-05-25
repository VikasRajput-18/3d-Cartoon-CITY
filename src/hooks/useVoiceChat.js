import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { minimapState } from '@/lib/minimapState'
import { voiceState, saveMuted } from '@/lib/voiceState'

const MAX_DIST  = 20
const NEAR_DIST = 5
const MID_DIST  = 15

function distToGain(dist) {
  if (dist >= MAX_DIST)  return 0
  if (dist <= NEAR_DIST) return 1
  if (dist <= MID_DIST)  return 1 - ((dist - NEAR_DIST) / (MID_DIST - NEAR_DIST)) * 0.9
  return 0.1 * (1 - (dist - MID_DIST) / (MAX_DIST - MID_DIST))
}

// Clerk UIDs contain special chars; PeerJS IDs must be alphanumeric only
export function sanitizePeerId(uid) {
  return 'clu3d' + uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 55)
}

export function useVoiceChat({ userId, onlinePlayers }) {
  const [voiceEnabled,  setVoiceEnabled]  = useState(false)
  const [pttMode,       setPttMode]       = useState(false)
  const [localSpeaking, setLocalSpeaking] = useState(false)
  const [error,         setError]         = useState(null)
  const [inputVol,      setInputVolState] = useState(1)
  const [outputVol,     setOutputVolState] = useState(1)

  const peerRef        = useRef(null)
  const localStreamRef = useRef(null)
  const audioCtxRef    = useRef(null)

  // uid → { call: MediaConnection, audio: HTMLAudioElement }
  const peersRef     = useRef(new Map())
  // uid → AnalyserNode (for speaking detection without playback)
  const analysersRef = useRef(new Map())

  const inputGainRef     = useRef(null)
  const analyserLocalRef = useRef(null)
  const localBufRef      = useRef(null)

  const enabledRef      = useRef(false)
  const pttModeRef      = useRef(false)
  const outputVolRef    = useRef(1)
  const onlinePlayersRef = useRef(onlinePlayers)
  const userIdRef        = useRef(userId)

  useEffect(() => { onlinePlayersRef.current = onlinePlayers }, [onlinePlayers])
  useEffect(() => { userIdRef.current = userId }, [userId])

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    return audioCtxRef.current
  }, [])

  // Attach a remote MediaStream to an <audio> element + Web Audio analyser
  const attachRemoteStream = useCallback((uid, remoteStream) => {
    const audio = new Audio()
    audio.srcObject = remoteStream
    audio.autoplay  = true
    audio.muted     = false
    audio.volume    = 0  // starts silent; proximity loop sets it
    audio.play().catch(e => console.warn('[Voice] audio.play() failed:', e))
    console.log(`[Voice] Attached remote stream for ${uid}`)

    // Analyser for speaking detection (not connected to destination — audio element handles playback)
    try {
      const ctx     = getAudioCtx()
      const source  = ctx.createMediaStreamSource(remoteStream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analysersRef.current.set(uid, analyser)
    } catch (e) {
      console.warn('[Voice] Analyser setup failed:', e)
    }

    return audio
  }, [getAudioCtx])

  // Wire handlers for an answered/initiated call
  const setupCall = useCallback((call, uid) => {
    call.on('stream', (remoteStream) => {
      const audio = attachRemoteStream(uid, remoteStream)
      const prev  = peersRef.current.get(uid) || {}
      peersRef.current.set(uid, { ...prev, call, audio })
    })
    call.on('close', () => {
      console.log(`[Voice] Call closed with ${uid}`)
      const p = peersRef.current.get(uid)
      if (p?.audio) { p.audio.srcObject = null }
      peersRef.current.delete(uid)
      analysersRef.current.delete(uid)
      voiceState.speakingSet.delete(uid)
    })
    call.on('error', err => {
      console.warn(`[Voice] Call error with ${uid}:`, err)
      peersRef.current.delete(uid)
      analysersRef.current.delete(uid)
      voiceState.speakingSet.delete(uid)
    })
  }, [attachRemoteStream])

  // Initiate a call to a remote peer
  const callPeer = useCallback((uid) => {
    if (!peerRef.current || peerRef.current.destroyed) return
    if (peersRef.current.has(uid))   return
    if (!localStreamRef.current)     return
    if (uid === userIdRef.current)   return

    // Placeholder to prevent concurrent double-calls
    peersRef.current.set(uid, { call: null, audio: null })

    const peerId = sanitizePeerId(uid)
    console.log(`[Voice] Calling peer ${uid} → peerId: ${peerId}`)

    try {
      const call = peerRef.current.call(peerId, localStreamRef.current)
      if (!call) { peersRef.current.delete(uid); return }
      peersRef.current.set(uid, { call, audio: null })
      setupCall(call, uid)
    } catch (err) {
      console.warn(`[Voice] call() threw for ${uid}:`, err)
      peersRef.current.delete(uid)
    }
  }, [setupCall])

  // ── Proximity volume — runs every 500ms ──────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!enabledRef.current) return
      const myX = minimapState.playerX
      const myZ = minimapState.playerZ

      for (const [uid, p] of peersRef.current) {
        if (!p?.audio) continue

        if (voiceState.mutedSet.has(uid)) {
          p.audio.volume = 0
          continue
        }

        const data = remotePlayersRef.current.get(uid)
        const dx   = data ? data.x - myX : MAX_DIST + 1
        const dz   = data ? data.z - myZ : 0
        const dist = Math.sqrt(dx * dx + dz * dz)
        const gain = Math.max(0, Math.min(1, distToGain(dist) * outputVolRef.current))

        p.audio.volume = gain
        console.log(`[Voice] ${uid.slice(-6)} dist=${dist.toFixed(1)} vol=${gain.toFixed(2)}`)
      }
    }, 500)
    return () => clearInterval(id)
  }, [])

  // ── Speaking detection — runs every 50ms ─────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      // Local speaking
      if (analyserLocalRef.current && localBufRef.current) {
        analyserLocalRef.current.getByteFrequencyData(localBufRef.current)
        const avg    = localBufRef.current.reduce((s, v) => s + v, 0) / localBufRef.current.length
        const active = pttModeRef.current ? voiceState.pttActive : true
        const speaking = active && avg > 18
        if (speaking !== voiceState.localSpeaking) {
          voiceState.localSpeaking = speaking
          setLocalSpeaking(speaking)
        }
      }
      // Remote speaking
      for (const [uid, analyser] of analysersRef.current) {
        const buf = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(buf)
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length
        if (avg > 12) voiceState.speakingSet.add(uid)
        else          voiceState.speakingSet.delete(uid)
      }
    }, 50)
    return () => clearInterval(id)
  }, [])

  // ── Push-to-talk (V key) ─────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'KeyV' || !enabledRef.current || !pttModeRef.current) return
      if (voiceState.pttActive) return
      voiceState.pttActive = true
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true })
    }
    const onKeyUp = (e) => {
      if (e.code !== 'KeyV') return
      voiceState.pttActive = false
      if (pttModeRef.current) {
        localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
    }
  }, [])

  // ── Voice-status broadcast (peer discovery for live joins) ───────────────
  useEffect(() => {
    if (!supabase || !userId) return
    const ch = supabase.channel('game-voice')
    ch.on('broadcast', { event: 'voice-status' }, ({ payload }) => {
      if (!payload?.uid || payload.uid === userId) return
      const uid = payload.uid
      if (payload.voice_enabled) {
        voiceState.voiceEnabledSet.add(uid)
        if (enabledRef.current) callPeer(uid)
      } else {
        voiceState.voiceEnabledSet.delete(uid)
        const p = peersRef.current.get(uid)
        if (p?.call)  p.call.close()
        if (p?.audio) p.audio.srcObject = null
        peersRef.current.delete(uid)
        analysersRef.current.delete(uid)
        voiceState.speakingSet.delete(uid)
      }
    })
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId, callPeer])

  // Call newly voice-enabled players as they appear in onlinePlayers list
  useEffect(() => {
    if (!enabledRef.current) return
    for (const p of onlinePlayers) {
      if (p.uid === userId) continue
      if (p.voice_enabled && !peersRef.current.has(p.uid)) {
        callPeer(p.uid)
      }
    }
  }, [onlinePlayers, callPeer, userId])

  // ── Enable voice chat ────────────────────────────────────────────────────
  const enableVoice = useCallback(async () => {
    if (enabledRef.current) return
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice chat requires a modern browser with WebRTC support.')
      return
    }
    setError(null)

    try {
      console.log('[Voice] Requesting microphone permission...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      console.log('[Voice] Microphone stream obtained, ID:', stream.id)
      localStreamRef.current = stream

      // Local analyser for speaking detection
      const ctx     = getAudioCtx()
      const source  = ctx.createMediaStreamSource(stream)
      const inputG  = ctx.createGain()
      inputGainRef.current = inputG
      inputG.gain.value    = 1.0
      const anlLocal = ctx.createAnalyser()
      anlLocal.fftSize = 256
      analyserLocalRef.current = anlLocal
      localBufRef.current = new Uint8Array(anlLocal.frequencyBinCount)
      source.connect(inputG)
      inputG.connect(anlLocal)
      // NOT connected to ctx.destination — we never play our own mic back

      // Create PeerJS peer using public PeerJS server
      const { default: Peer } = await import('peerjs')
      const myPeerId = sanitizePeerId(userIdRef.current)
      console.log('[Voice] Creating PeerJS peer, ID:', myPeerId)

      const peer = new Peer(myPeerId, {
        host:   '0.peerjs.com',
        port:   443,
        path:   '/',
        secure: true,
        debug:  1,
      })
      peerRef.current = peer

      peer.on('open', async (openedId) => {
        console.log('[Voice] PeerJS connected! Confirmed peer ID:', openedId)
        enabledRef.current    = true
        voiceState.enabled    = true
        setVoiceEnabled(true)
        setError(null)

        // Answer all incoming calls automatically
        peer.on('call', (call) => {
          console.log('[Voice] Incoming call from PeerJS ID:', call.peer)
          call.answer(localStreamRef.current)

          // Map PeerJS ID back to a uid
          let callerUid = null
          for (const p of onlinePlayersRef.current) {
            if (sanitizePeerId(p.uid) === call.peer) { callerUid = p.uid; break }
          }
          if (!callerUid) {
            for (const [uid] of remotePlayersRef.current) {
              if (sanitizePeerId(uid) === call.peer) { callerUid = uid; break }
            }
          }

          if (callerUid) {
            // Avoid replacing an already-healthy connection
            const existing = peersRef.current.get(callerUid)
            if (!existing || !existing.call) {
              peersRef.current.set(callerUid, { call, audio: null })
              setupCall(call, callerUid)
            }
          } else {
            // Unknown caller — still set up so stream plays
            console.warn('[Voice] Unknown caller PeerJS ID:', call.peer)
            setupCall(call, call.peer)
          }
        })

        // Announce that we're voice-enabled to others in the channel
        supabase.channel('game-voice').send({
          type: 'broadcast', event: 'voice-status',
          payload: { uid: userIdRef.current, voice_enabled: true },
        })

        // Fetch all currently voice-enabled players from Supabase and call them
        try {
          const { data, error: dbErr } = await supabase
            .from('players')
            .select('uid')
            .eq('voice_enabled', true)

          if (dbErr) {
            console.warn('[Voice] Supabase fetch error:', dbErr.message)
          } else if (data) {
            console.log(`[Voice] Found ${data.length} voice-enabled players in DB`)
            for (const row of data) {
              if (row.uid !== userIdRef.current) {
                callPeer(row.uid)
              }
            }
          }
        } catch (e) {
          console.warn('[Voice] Failed to fetch voice-enabled players:', e)
        }

        // Persist voice_enabled = true in DB
        supabase.from('players')
          .upsert({ uid: userId, voice_enabled: true }, { onConflict: 'uid' })
          .then(undefined, () => {})
      })

      peer.on('error', (err) => {
        console.error('[Voice] PeerJS error:', err.type, err)
        if (err.type === 'unavailable-id') {
          setError('Peer ID conflict — please try again.')
          peer.destroy()
          peerRef.current   = null
          enabledRef.current = false
          voiceState.enabled = false
          setVoiceEnabled(false)
        } else {
          setError(`Voice error: ${err.type}`)
        }
      })

      peer.on('disconnected', () => {
        console.warn('[Voice] PeerJS disconnected, attempting reconnect...')
        if (!peer.destroyed) peer.reconnect()
      })

    } catch (err) {
      console.error('[Voice] enableVoice failed:', err)
      const msg =
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access denied. Please allow microphone permission in your browser settings and try again.'
          : 'Could not start voice chat: ' + (err.message || 'Unknown error')
      setError(msg)
    }
  }, [userId, getAudioCtx, callPeer, setupCall])

  // ── Disable voice chat ───────────────────────────────────────────────────
  const disableVoice = useCallback(() => {
    if (!enabledRef.current) return
    for (const [uid, p] of peersRef.current) {
      p?.call?.close()
      if (p?.audio) { p.audio.srcObject = null }
      voiceState.speakingSet.delete(uid)
    }
    peersRef.current.clear()
    analysersRef.current.clear()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current  = null
    analyserLocalRef.current = null
    localBufRef.current     = null
    if (peerRef.current) { peerRef.current.destroy(); peerRef.current = null }

    enabledRef.current    = false
    voiceState.enabled    = false
    voiceState.localSpeaking = false
    voiceState.pttActive  = false
    setVoiceEnabled(false)
    setLocalSpeaking(false)

    supabase.channel('game-voice').send({
      type: 'broadcast', event: 'voice-status',
      payload: { uid: userId, voice_enabled: false },
    })
    supabase.from('players')
      .upsert({ uid: userId, voice_enabled: false }, { onConflict: 'uid' })
      .then(undefined, () => {})
  }, [userId])

  const toggleVoice = useCallback(
    () => { if (enabledRef.current) disableVoice(); else enableVoice() },
    [enableVoice, disableVoice]
  )

  const togglePttMode = useCallback(() => {
    const next = !pttModeRef.current
    pttModeRef.current = next
    voiceState.pttMode = next
    setPttMode(next)
    if (next) {
      // PTT on → mute mic until V held
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false })
      voiceState.pttActive = false
    } else {
      // Open mic → always live
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = true })
    }
  }, [])

  const setInputVolume = useCallback((val) => {
    if (inputGainRef.current) inputGainRef.current.gain.value = val
    setInputVolState(val)
  }, [])

  const setOutputVolume = useCallback((val) => {
    outputVolRef.current = val
    setOutputVolState(val)
  }, [])

  const mutePlayer    = useCallback((uid) => {
    voiceState.mutedSet.add(uid)
    saveMuted()
    const p = peersRef.current.get(uid)
    if (p?.audio) p.audio.volume = 0
  }, [])
  const unmutePlayer  = useCallback((uid) => {
    voiceState.mutedSet.delete(uid)
    saveMuted()
  }, [])
  const isPlayerMuted = useCallback((uid) => voiceState.mutedSet.has(uid), [])

  // Cleanup on unmount
  useEffect(() => () => { disableVoice() }, [disableVoice])

  return {
    voiceEnabled, pttMode, localSpeaking, error, inputVol, outputVol,
    toggleVoice, togglePttMode,
    setInputVolume, setOutputVolume,
    mutePlayer, unmutePlayer, isPlayerMuted,
  }
}
