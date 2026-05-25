import React, { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import NPCModel from './NPCModel'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { minimapState } from '@/lib/minimapState'
import { voiceState } from '@/lib/voiceState'

const VIS_DIST_SQ = 1600  // 40 units²

// Module-level speech bubble store: uid → { text, expires, type }
export const speechBubbles = new Map()

export function showSpeechBubble(uid, text, type = 'chat') {
  speechBubbles.set(uid, { text: text.slice(0, 28), expires: Date.now() + 4500, type })
}

function RemotePlayer({ uid, onPlayerClick, onPlayerContextMenu }) {
  const groupRef      = useRef()
  const visRef        = useRef(false)
  const glowRingRef   = useRef()
  const glowT         = useRef(Math.random() * Math.PI * 2)  // stagger pulse per player

  const isWalkingRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)

  const displayRef = useRef({ name: 'Player', outfit: 'casual', skin: '#F4C08A' })
  const [display, setDisplay] = useState({ name: 'Player', outfit: 'casual', skin: '#F4C08A' })

  const inVehicleRef    = useRef(false)
  const hoveredRef      = useRef(false)
  const hoverRingRef    = useRef()
  const bounceRef       = useRef(0)

  const [showPopup, setShowPopup] = useState(false)
  const popupTimerRef = useRef(null)

  const speakingStateRef = useRef(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const mutedStateRef = useRef(false)
  const [isMuted, setIsMuted] = useState(false)

  const remoteEmoteRef = useRef('')
  const [remoteEmote, setRemoteEmote] = useState('')

  // Speech bubble state
  const [bubble, setBubble] = useState(null)
  const bubbleCheckRef = useRef(0)

  const longPressTimerRef    = useRef(null)
  const longPressTriggeredRef = useRef(false)

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      document.body.style.cursor = 'default'
    }
  }, [])

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const data  = remotePlayersRef.current.get(uid)

    if (!groupRef.current) return

    if (!data) {
      groupRef.current.visible = false
      return
    }

    // ── Distance culling ──────────────────────────────────────────────────
    const dToPx  = data.x - minimapState.playerX
    const dToPz  = data.z - minimapState.playerZ
    const distSq = dToPx * dToPx + dToPz * dToPz
    const inView = distSq < VIS_DIST_SQ
    visRef.current = inView

    const nowInVehicle = !!data.is_in_vehicle
    if (nowInVehicle !== inVehicleRef.current) inVehicleRef.current = nowInVehicle
    groupRef.current.visible = inView && !nowInVehicle
    if (!inView || nowInVehicle) return

    // ── Position buffer → smooth lerp ─────────────────────────────────────
    const lerpAlpha = Math.min(1, delta * 12)
    if (data.posBuffer && data.posBuffer.length > 0) {
      const tgt = data.posBuffer[0]
      data.x = THREE.MathUtils.lerp(data.x, tgt.x, lerpAlpha)
      data.z = THREE.MathUtils.lerp(data.z, tgt.z, lerpAlpha)
      let diff = tgt.facing - data.facing
      while (diff >  Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      data.facing += diff * lerpAlpha
      const rx = tgt.x - data.x, rz = tgt.z - data.z
      if (rx * rx + rz * rz < 0.01) data.posBuffer.shift()
    }

    groupRef.current.position.set(data.x, 0, data.z)
    groupRef.current.rotation.y = data.facing

    // ── Walking animation ─────────────────────────────────────────────────
    const nowWalking = !!data.is_moving
    if (nowWalking !== isWalkingRef.current) {
      isWalkingRef.current = nowWalking
      setIsWalking(nowWalking)
    }

    // ── Visual properties ─────────────────────────────────────────────────
    if (data.name && (
      data.name   !== displayRef.current.name   ||
      data.outfit !== displayRef.current.outfit ||
      data.skin   !== displayRef.current.skin
    )) {
      const next = { name: data.name, outfit: data.outfit, skin: data.skin }
      displayRef.current = next
      setDisplay(next)
    }

    // ── Glow ring pulse ───────────────────────────────────────────────────
    glowT.current += delta * 2.2
    if (glowRingRef.current) {
      glowRingRef.current.material.opacity = 0.22 + Math.sin(glowT.current) * 0.14
    }

    // ── Hover ring ────────────────────────────────────────────────────────
    if (hoverRingRef.current) {
      const targetOpacity = hoveredRef.current ? 0.65 : 0
      hoverRingRef.current.material.opacity = THREE.MathUtils.lerp(
        hoverRingRef.current.material.opacity, targetOpacity, delta * 10
      )
    }

    // ── Bounce on click ───────────────────────────────────────────────────
    if (bounceRef.current > 0) {
      bounceRef.current -= delta
      const t = 1 - Math.max(0, bounceRef.current / 0.5)
      const s = 1 + Math.sin(t * Math.PI * 2.5) * 0.18
      groupRef.current.scale.setScalar(s)
    } else if (groupRef.current.scale.x !== 1) {
      groupRef.current.scale.setScalar(1)
    }

    // ── Voice speaking indicator ──────────────────────────────────────────
    const nowSpeaking = voiceState.speakingSet.has(uid)
    if (nowSpeaking !== speakingStateRef.current) {
      speakingStateRef.current = nowSpeaking
      setIsSpeaking(nowSpeaking)
    }

    // ── Muted indicator ───────────────────────────────────────────────────
    const nowMuted = voiceState.mutedSet.has(uid)
    if (nowMuted !== mutedStateRef.current) {
      mutedStateRef.current = nowMuted
      setIsMuted(nowMuted)
    }

    // ── Remote emote ──────────────────────────────────────────────────────
    const nowEmote = data.current_emote || ''
    if (nowEmote !== remoteEmoteRef.current) {
      remoteEmoteRef.current = nowEmote
      setRemoteEmote(nowEmote)
    }

    // ── Speech bubble check (every 500 ms) ───────────────────────────────
    bubbleCheckRef.current += delta
    if (bubbleCheckRef.current > 0.5) {
      bubbleCheckRef.current = 0
      const b = speechBubbles.get(uid)
      if (b && Date.now() < b.expires) {
        setBubble(b)
      } else {
        speechBubbles.delete(uid)
        setBubble(null)
      }
    }
  })

  const handlePointerOver = (e) => { e.stopPropagation(); hoveredRef.current = true;  document.body.style.cursor = 'pointer' }
  const handlePointerOut  = (e) => { e.stopPropagation(); hoveredRef.current = false; document.body.style.cursor = 'default' }

  const handleClick = (e) => {
    e.stopPropagation()
    if (longPressTriggeredRef.current) return
    if (!onPlayerClick) return
    bounceRef.current = 0.5
    setShowPopup(true)
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    popupTimerRef.current = setTimeout(() => {
      setShowPopup(false)
      onPlayerClick(uid, display.name)
    }, 900)
  }

  const handleContextMenu = (e) => {
    e.stopPropagation()
    e.nativeEvent?.preventDefault()
    if (onPlayerContextMenu) {
      onPlayerContextMenu(uid, display.name, e.clientX ?? e.x ?? 0, e.clientY ?? e.y ?? 0)
    }
  }

  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.button !== undefined) return
    longPressTriggeredRef.current = false
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      if (onPlayerContextMenu) {
        onPlayerContextMenu(uid, display.name, e.clientX ?? 0, e.clientY ?? 0)
      }
    }, 600)
  }
  const handlePointerUpCancel = () => { clearTimeout(longPressTimerRef.current) }

  return (
    <group ref={groupRef} visible={false}>
      {/* Invisible hitbox */}
      <mesh
        position={[0, 1.2, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpCancel}
      >
        <boxGeometry args={[1.4, 2.6, 1.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Glow ring at feet — pulsing green/cyan, clearly visible from far */}
      <mesh ref={glowRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.72, 1.08, 36]} />
        <meshBasicMaterial color="#00e5ff" transparent opacity={0.3} depthWrite={false} />
      </mesh>

      {/* Hover glow ring */}
      <mesh ref={hoverRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, 0.82, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>

      {/* Click name popup */}
      {showPopup && (
        <Billboard position={[0, 3.4, 0]}>
          <Text fontSize={0.22} color="#ffffff" outlineWidth={0.012} outlineColor="#7c3aed" anchorX="center" anchorY="middle">
            {display.name}
          </Text>
        </Billboard>
      )}

      {/* Speech bubble — shown when DM/chat arrives */}
      {bubble && (
        <Billboard position={[0, 3.8, 0]}>
          <Text
            fontSize={0.19}
            color={bubble.type === 'dm' ? '#ffd700' : '#ffffff'}
            anchorX="center"
            anchorY="middle"
            outlineColor="#000000"
            outlineWidth={0.015}
            maxWidth={3.5}
          >
            {bubble.type === 'dm' ? `💬 ${bubble.text}` : `🗨️ ${bubble.text}`}
          </Text>
        </Billboard>
      )}

      {/* Voice speaking indicator */}
      {isSpeaking && !isMuted && (
        <Billboard position={[0, 3.55, 0]}>
          <Text fontSize={0.2} anchorX="center" anchorY="middle">🔊</Text>
        </Billboard>
      )}

      {/* Muted indicator */}
      {isMuted && (
        <Billboard position={[0, 3.55, 0]}>
          <Text fontSize={0.2} anchorX="center" anchorY="middle">🔇</Text>
        </Billboard>
      )}

      {/* Character — gold name, star sublabel to distinguish from NPCs */}
      <NPCModel
        outfit={display.outfit}
        skin={display.skin}
        walking={isWalking}
        emote={remoteEmote}
        name={`★ ${display.name}`}
        labelColor="#ffd700"
        sublabel="● Online"
        sublabelColor="#00e5ff"
        npcScale={0.01}
        visibleRef={visRef}
      />
    </group>
  )
}

export default React.memo(RemotePlayer)
