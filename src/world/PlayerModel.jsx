// Local + remote player avatar — now a lightweight primitive character (Avatar3D)
// instead of the 65-bone / 49k-triangle Mixamo FBX. Same prop interface and
// groupRef contract so vehicle entry, labels, emotes and collision all still work.
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import Avatar3D from './Avatar3D'

// One-shot emotes finish after this long, then onEmoteEnd fires (mirrors the
// old FBX clip-finished behaviour). 'dance' loops until the emote prop clears.
const EMOTE_DURATION = { greet: 1600, handshake: 1800, laughing: 2000 }

export default function PlayerModel({
  walking    = false,
  running    = false,
  sitting    = false,
  swimming   = false,
  name       = '',
  outfit     = 'casual',
  skin       = '#F4C08A',
  hair       = '#2C1810',
  emote      = '',
  onEmoteEnd = null,
  visibleRef = null,   // remote players pass this; local player leaves it null
}) {
  const groupRef = useRef()
  const bodyRef  = useRef()   // emote target (bob / tilt / sway)

  // ── Force-visible enforcement + remote cull ────────────────────────────────
  // Something was leaving the avatar's solid (toon) materials at ~0 opacity so
  // only the unlit eye-shine showed. Re-assert visibility each frame: solid
  // materials (opacity unexpectedly < 0.1) are restored to 1/opaque, and the
  // _keepPBR flag tells ToonStyle to leave these materials alone. Intentionally
  // translucent bits (shadow 0.25, cheeks 0.6) are left untouched.
  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    if (visibleRef) g.visible = visibleRef.current !== false
    else            g.visible = true

    // Force the local player's SOLID materials opaque every frame. The local
    // player is the target of the camera→player occlusion raycast; something in
    // that path was leaving the body/head/limb materials transparent, so they
    // rendered see-through (only the eyes showed). This unconditionally re-asserts
    // opacity, skipping the two INTENTIONALLY translucent bits:
    //   • the ground shadow disc (depthWrite === false)
    //   • the pink cheeks (#ffb6c1)
    // Player-only — NPCs render fine and are not touched.
    g.traverse(c => {
      if (!c.isMesh || !c.material) return
      c.visible = true
      c.userData._keepPBR = true            // ToonStyle: don't re-convert
      c.userData.isPlayer = true            // CityMerger: NEVER merge/dispose
      c.userData.noMerge  = true            // (the merger was eating the player)
      c.userData.dynamic  = true
      const mats = Array.isArray(c.material) ? c.material : [c.material]
      mats.forEach(m => {
        if (m.depthWrite === false) return                       // shadow disc
        if (m.color && m.color.getHexString() === 'ffb6c1') return // cheeks
        if (m.opacity !== 1 || m.transparent) {
          m.transparent = false
          m.opacity = 1
          m.depthWrite = true
          m.needsUpdate = true
        }
      })
    })
  })

  // ── Emotes via simple transforms (no skeleton) ─────────────────────────────
  const emoteRef  = useRef('')
  const emoteT    = useRef(0)
  useEffect(() => { emoteRef.current = emote; emoteT.current = 0 }, [emote])

  // One-shot emote completion → notify parent
  useEffect(() => {
    if (!emote || emote === 'dance') return
    const dur = EMOTE_DURATION[emote] ?? 1600
    const id = setTimeout(() => onEmoteEnd?.(), dur)
    return () => clearTimeout(id)
  }, [emote, onEmoteEnd])

  useFrame((state, delta) => {
    const b = bodyRef.current
    if (!b) return
    // Swimming pose: lean forward (face-down stroke) + gentle bob, overrides emotes.
    if (swimming) {
      const t = state.clock.elapsedTime
      b.rotation.x += (-0.9 - b.rotation.x) * Math.min(1, delta * 8)
      b.rotation.z = Math.sin(t * 6) * 0.12        // alternating roll like a freestyle stroke
      b.position.y = Math.sin(t * 4) * 0.05
      return
    }
    if (b.rotation.x !== 0) b.rotation.x += (0 - b.rotation.x) * Math.min(1, delta * 8)
    const e = emoteRef.current
    if (!e) {
      // ease back to neutral
      b.rotation.z += (0 - b.rotation.z) * Math.min(1, delta * 10)
      b.position.y += (0 - b.position.y) * Math.min(1, delta * 10)
      return
    }
    emoteT.current += delta
    const t = state.clock.elapsedTime
    if (e === 'dance') {
      b.position.y = Math.abs(Math.sin(t * 6)) * 0.12
      b.rotation.z = Math.sin(t * 6) * 0.18
    } else if (e === 'laughing') {
      b.rotation.z = Math.sin(t * 10) * 0.12
    } else if (e === 'greet' || e === 'handshake') {
      b.position.y = Math.sin(t * 8) * 0.05
    }
  })

  return (
    <group ref={groupRef}>
      {/* bodyRef wraps the avatar so emote transforms don't fight Avatar3D's
          own limb animation (which uses externalControl + walking) */}
      <group ref={bodyRef}>
        <Avatar3D
          externalControl
          walking={walking || running}
          outfit={outfit}
          skin={skin}
          hair={hair}
          isPlayer={!visibleRef}
        />
      </group>
      {name ? (
        <Billboard position={[0, 2.4, 0]}>
          <Text fontSize={0.2} color="#facc15" anchorX="center" anchorY="middle">★ {name}</Text>
          {!visibleRef && (
            <Text fontSize={0.12} color="#facc15" anchorX="center" anchorY="middle" position={[0, -0.27, 0]}>• You</Text>
          )}
        </Billboard>
      ) : null}
    </group>
  )
}
