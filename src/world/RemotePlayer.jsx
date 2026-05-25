import React, { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import NPCModel from './NPCModel'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { minimapState } from '@/lib/minimapState'
import { voiceState } from '@/lib/voiceState'

const VIS_DIST_SQ = 1600  // 40 units²

function RemotePlayer({ uid, onPlayerClick, onPlayerContextMenu }) {
  const groupRef     = useRef()
  const visRef       = useRef(false)

  // Walking animation
  const isWalkingRef = useRef(false)
  const [isWalking, setIsWalking] = useState(false)

  // Visual properties (name / outfit / skin)
  const displayRef = useRef({ name: 'Player', outfit: 'casual', skin: '#F4C08A' })
  const [display, setDisplay] = useState({ name: 'Player', outfit: 'casual', skin: '#F4C08A' })

  // In-vehicle flag — hides character while driving (RemoteVehicle owns that rendering)
  const inVehicleRef = useRef(false)

  // Hover UX
  const hoveredRef   = useRef(false)
  const hoverRingRef = useRef()

  // Click bounce animation (seconds countdown)
  const bounceRef = useRef(0)

  // Name popup before DM opens
  const [showPopup, setShowPopup] = useState(false)
  const popupTimerRef = useRef(null)

  // Voice speaking indicator
  const speakingStateRef = useRef(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Muted state
  const mutedStateRef = useRef(false)
  const [isMuted, setIsMuted] = useState(false)

  // Remote emote state
  const remoteEmoteRef = useRef('')
  const [remoteEmote, setRemoteEmote] = useState('')

  // Long-press for mobile context menu
  const longPressTimerRef = useRef(null)
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

    // Hide character while in vehicle — RemoteVehicle shows the car/bike
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
  })

  const handlePointerOver = (e) => { e.stopPropagation(); hoveredRef.current = true;  document.body.style.cursor = 'pointer' }
  const handlePointerOut  = (e) => { e.stopPropagation(); hoveredRef.current = false; document.body.style.cursor = 'default' }

  const handleClick = (e) => {
    e.stopPropagation()
    if (longPressTriggeredRef.current) return  // long-press already handled
    if (!onPlayerClick) return
    bounceRef.current = 0.5
    setShowPopup(true)
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current)
    popupTimerRef.current = setTimeout(() => {
      setShowPopup(false)
      onPlayerClick(uid, display.name)
    }, 900)
  }

  // Right-click context menu (desktop)
  const handleContextMenu = (e) => {
    e.stopPropagation()
    e.nativeEvent?.preventDefault()  // suppress browser context menu
    if (onPlayerContextMenu) {
      onPlayerContextMenu(uid, display.name, e.clientX ?? e.x ?? 0, e.clientY ?? e.y ?? 0)
    }
  }

  // Long-press for mobile context menu
  const handlePointerDown = (e) => {
    if (e.button !== 0 && e.button !== undefined) return  // right-click handled by onContextMenu
    longPressTriggeredRef.current = false
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      if (onPlayerContextMenu) {
        onPlayerContextMenu(uid, display.name, e.clientX ?? 0, e.clientY ?? 0)
      }
    }, 600)
  }
  const handlePointerUpCancel = () => {
    clearTimeout(longPressTimerRef.current)
  }

  return (
    <group ref={groupRef} visible={false}>
      {/* Invisible hitbox for pointer events */}
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

      {/* Hover glow ring at feet */}
      <mesh ref={hoverRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.5, 0.82, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} />
      </mesh>

      {/* Name popup 900 ms after click, before DM opens */}
      {showPopup && (
        <Billboard position={[0, 3.4, 0]}>
          <Text fontSize={0.22} color="#ffffff" outlineWidth={0.012} outlineColor="#7c3aed" anchorX="center" anchorY="middle">
            {display.name}
          </Text>
        </Billboard>
      )}

      {/* Voice speaking indicator — green wave above head */}
      {isSpeaking && !isMuted && (
        <Billboard position={[0, 3.85, 0]}>
          <Text fontSize={0.2} anchorX="center" anchorY="middle">
            🔊
          </Text>
        </Billboard>
      )}

      {/* Muted indicator */}
      {isMuted && (
        <Billboard position={[0, 3.85, 0]}>
          <Text fontSize={0.2} anchorX="center" anchorY="middle">
            🔇
          </Text>
        </Billboard>
      )}

      {/* Walking character — hidden while in vehicle */}
      <NPCModel
        outfit={display.outfit}
        skin={display.skin}
        walking={isWalking}
        emote={remoteEmote}
        name={display.name}
        labelColor="#60a5fa"
        sublabel="• Player"
        sublabelColor="#4ade80"
        npcScale={0.01}
        visibleRef={visRef}
      />
    </group>
  )
}

export default React.memo(RemotePlayer)
