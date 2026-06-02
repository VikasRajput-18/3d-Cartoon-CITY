// NPC avatar — lightweight primitive character (Avatar3D) instead of the
// 65-bone / 49k-triangle Mixamo FBX. Same prop interface, groupRef, visibleRef
// cull/fade, onClick and labels preserved so culling + chat still work.
import React, { useRef, useEffect } from 'react'
import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import Avatar3D from './Avatar3D'

const EMOTE_DURATION = { greet: 1600, handshake: 1800, laughing: 2000 }

function NPCModel({
  outfit        = 'casual',
  skin          = '#F4C08A',
  hair          = '#2C1810',
  walking       = false,
  name          = '',
  labelColor    = '#facc15',
  sublabel      = '',
  sublabelColor = '#f59e0b',
  npcScale      = 1,
  onClick       = null,
  visibleRef    = null,
  emote         = '',
}) {
  const groupRef   = useRef()
  const bodyRef    = useRef()
  const opacityRef = useRef(1)

  // ── Visibility cull + smooth fade (mirrors the previous FBX behaviour) ──────
  // No skeleton/mixer to stop now — culling just toggles render + fades opacity.
  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const wantVisible = !(visibleRef && visibleRef.current === false)
    const targetOp = wantVisible ? 1 : 0
    const rate = wantVisible ? (1 / 0.5) : (1 / 0.3)
    if (opacityRef.current !== targetOp) {
      const step = rate * Math.min(delta, 0.05)
      opacityRef.current = wantVisible
        ? Math.min(1, opacityRef.current + step)
        : Math.max(0, opacityRef.current - step)
      const op = opacityRef.current
      g.traverse(c => {
        if (c.isMesh && c.material && c.material.transparent !== undefined) {
          c.material.transparent = true   // set once-ish; primitives are cheap to recompile
          c.material.opacity = op
        }
      })
    }
    g.visible = opacityRef.current > 0.01

    // Emote transforms on the body wrapper
    const b = bodyRef.current
    if (b) {
      const t = state.clock.elapsedTime
      if (emote === 'dance') { b.position.y = Math.abs(Math.sin(t * 6)) * 0.12; b.rotation.z = Math.sin(t * 6) * 0.18 }
      else if (emote === 'laughing') { b.rotation.z = Math.sin(t * 10) * 0.12 }
      else if (emote === 'greet' || emote === 'handshake') { b.position.y = Math.sin(t * 8) * 0.05 }
      else { b.rotation.z += (0 - b.rotation.z) * Math.min(1, delta * 10); b.position.y += (0 - b.position.y) * Math.min(1, delta * 10) }
    }
  })

  return (
    <group ref={groupRef} onClick={onClick}>
      <group ref={bodyRef} scale={[npcScale, npcScale, npcScale]}>
        <Avatar3D
          externalControl
          walking={walking}
          outfit={outfit}
          skin={skin}
          hair={hair}
        />
      </group>
      <Billboard position={[0, 2.4, 0]}>
        <Text fontSize={0.18} color={labelColor} anchorX="center" anchorY="middle">{name}</Text>
        {sublabel ? (
          <Text fontSize={0.11} color={sublabelColor} anchorX="center" anchorY="middle" position={[0, -0.23, 0]}>
            {sublabel}
          </Text>
        ) : null}
      </Billboard>
    </group>
  )
}

export default React.memo(NPCModel)
