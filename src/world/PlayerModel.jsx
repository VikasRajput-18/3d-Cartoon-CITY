import { useRef, useEffect, useMemo } from 'react'
import { useFBX, useAnimations, Billboard, Text } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'

const OUTFIT_COLORS = {
  casual:      '#7C3AED',
  school:      '#1D4ED8',
  party:       '#DB2777',
  traditional: '#D97706',
  winter:      '#0F766E',
  sports:      '#DC2626',
}

function boneRegion(name) {
  const n = name.toLowerCase()
  if (n.includes('toe')    || n.includes('foot'))                           return 'shoe'
  if (n.includes('upleg')  || n.includes('leg'))                            return 'pants'
  if (n.includes('hip'))                                                    return 'pants'
  if (n.includes('forearm')|| n.includes('fore_arm')|| n.includes('lowerarm')) return 'skin'
  if (n.includes('hand')   || n.includes('finger') || n.includes('thumb')  ||
      n.includes('index')  || n.includes('middle') || n.includes('ring')   || n.includes('pinky')) return 'skin'
  if (n.includes('arm'))                                                    return 'shirt'
  if (n.includes('head')   || n.includes('neck'))                           return 'skin'
  return 'shirt'
}

const _pantsC = new THREE.Color('#1c1c2e')
const _shoeC  = new THREE.Color('#120e08')

function paintClothing(mesh, skinHex, outfitHex) {
  const geo   = mesh.geometry
  const bones = mesh.skeleton?.bones
  if (!bones || !geo.attributes.skinIndex) {
    mesh.material = new THREE.MeshToonMaterial({ color: skinHex, emissive: new THREE.Color(0.06, 0.06, 0.08) })
    mesh.castShadow = true
    return
  }
  const si    = geo.attributes.skinIndex
  const sw    = geo.attributes.skinWeight
  const count = geo.attributes.position.count
  const skinC   = new THREE.Color(skinHex)
  const outfitC = new THREE.Color(outfitHex)
  let attr = geo.attributes.color
  let arr
  if (attr && attr.count === count) { arr = attr.array }
  else                               { arr = new Float32Array(count * 3) }
  for (let i = 0; i < count; i++) {
    let maxW = -1, domIdx = 0
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(i, j)
      if (w > maxW) { maxW = w; domIdx = si.getComponent(i, j) }
    }
    const bone = bones[domIdx]
    const region = bone ? boneRegion(bone.name) : 'shirt'
    const c = region === 'skin' ? skinC : region === 'pants' ? _pantsC : region === 'shoe' ? _shoeC : outfitC
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b
  }
  if (attr && attr.count === count) { attr.needsUpdate = true }
  else { geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)) }
  if (!mesh.material?.vertexColors) {
    mesh.material = new THREE.MeshToonMaterial({ vertexColors: true, emissive: new THREE.Color(0.07, 0.07, 0.09) })
  }
  mesh.castShadow = true
}

// Strip X/Z root-motion from a clip's Hips position track
function stripRootMotion(clip) {
  for (const track of clip.tracks) {
    const ln = track.name.toLowerCase()
    if ((ln.includes('hips') || ln.includes('hip')) && ln.endsWith('.position')) {
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = 0; track.values[i + 2] = 0
      }
    }
  }
}

const EMOTE_NAMES = ['dance', 'greet', 'handshake', 'laughing']

export default function PlayerModel({
  walking    = false,
  running    = false,
  sitting    = false,
  name       = '',
  outfit     = 'casual',
  skin       = '#F4C08A',
  emote      = '',
  onEmoteEnd = null,
}) {
  const groupRef = useRef()

  const rawWalkFBX      = useFBX('/models/Walking.fbx')
  const rawIdleFBX      = useFBX('/models/Standing_Idle.fbx')
  const rawDanceFBX     = useFBX('/sounds/dance.fbx')
  const rawGreetFBX     = useFBX('/sounds/greet.fbx')
  const rawHandshakeFBX = useFBX('/sounds/handshake.fbx')
  const rawLaughFBX     = useFBX('/sounds/laughing.fbx')

  const walkFBX = useMemo(() => {
    const clone = SkeletonUtils.clone(rawWalkFBX)
    clone.traverse(c => { if (c.isSkinnedMesh) c.geometry = c.geometry.clone() })
    return clone
  }, [rawWalkFBX])

  const outfitColor = OUTFIT_COLORS[outfit] || OUTFIT_COLORS.casual

  useEffect(() => {
    walkFBX.traverse(child => {
      if (child.isSkinnedMesh) paintClothing(child, skin, outfitColor)
    })
  }, [walkFBX, skin, outfitColor])

  const clips = useMemo(() => {
    const result = []
    if (rawWalkFBX.animations[0]) {
      const clip = rawWalkFBX.animations[0].clone()
      clip.name = 'Walking'
      stripRootMotion(clip)
      result.push(clip)
    }
    if (rawIdleFBX.animations[0]) {
      const clip = rawIdleFBX.animations[0].clone()
      clip.name = 'Idle'
      result.push(clip)
    }
    const emoteSources = [
      [rawDanceFBX, 'dance'], [rawGreetFBX, 'greet'],
      [rawHandshakeFBX, 'handshake'], [rawLaughFBX, 'laughing'],
    ]
    for (const [fbx, clipName] of emoteSources) {
      if (fbx.animations[0]) {
        const clip = fbx.animations[0].clone()
        clip.name = clipName
        stripRootMotion(clip)
        result.push(clip)
      }
    }
    return result
  }, [rawWalkFBX, rawIdleFBX, rawDanceFBX, rawGreetFBX, rawHandshakeFBX, rawLaughFBX])

  const { actions, mixer } = useAnimations(clips, groupRef)

  // ── Start idle on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (actions['Idle']) actions['Idle'].reset().play()
  }, [actions])

  // ── Walk / idle crossfade (skips when emote or sitting is active) ──────────
  useEffect(() => {
    if (emote || sitting) return
    const idle = actions['Idle']
    const walk = actions['Walking']
    if (!idle || !walk) return
    if (walking || running) { idle.fadeOut(0.2); walk.reset().fadeIn(0.2).play() }
    else                    { walk.fadeOut(0.3); idle.reset().fadeIn(0.3).play() }
  }, [walking, running, emote, sitting, actions])

  // ── Sitting in vehicle — freeze mixer at current keyframe (avoids T-pose) ──
  useEffect(() => {
    if (!mixer) return
    mixer.timeScale = sitting ? 0 : 1
    // When sitting ends, timeScale returns to 1 and the walk/idle effect re-fires
  }, [sitting, mixer])

  // ── Walk timeScale for running ────────────────────────────────────────────
  useEffect(() => {
    if (actions['Walking']) actions['Walking'].timeScale = running ? 1.6 : 1.0
  }, [running, actions])

  // ── Emote controller ──────────────────────────────────────────────────────
  const prevEmoteRef = useRef('')
  useEffect(() => {
    // Guard: if the emote didn't actually change (effect re-ran due to
    // onEmoteEnd reference changing), don't restart the animation.
    if (emote && emote === prevEmoteRef.current) return

    const prevEmote = prevEmoteRef.current
    prevEmoteRef.current = emote

    const idle = actions['Idle']
    const walk = actions['Walking']

    if (!emote) {
      // Leaving an emote — return to idle
      if (prevEmote) {
        const prev = actions[prevEmote]
        if (prev?.isRunning()) prev.fadeOut(0.2)
        if (idle) idle.reset().fadeIn(0.2).play()
      }
      return
    }

    const emoteAction = actions[emote]
    if (!emoteAction) return

    // Fade out walk, idle, and any previous emote
    if (idle?.isRunning()) idle.fadeOut(0.2)
    if (walk?.isRunning()) walk.fadeOut(0.2)
    if (prevEmote && prevEmote !== emote) {
      const prev = actions[prevEmote]
      if (prev?.isRunning()) prev.fadeOut(0.2)
    }

    const isDance = emote === 'dance'
    emoteAction.reset()
    if (isDance) {
      emoteAction.setLoop(THREE.LoopRepeat, Infinity)
    } else {
      emoteAction.setLoop(THREE.LoopOnce, 1)
      emoteAction.clampWhenFinished = true
    }
    emoteAction.fadeIn(0.2).play()

    // Notify parent when a one-shot emote finishes
    if (!isDance && mixer) {
      const onFinish = (e) => {
        if (e.action === emoteAction) {
          mixer.removeEventListener('finished', onFinish)
          onEmoteEnd?.()
        }
      }
      mixer.addEventListener('finished', onFinish)
      return () => { mixer.removeEventListener('finished', onFinish) }
    }
  }, [emote, actions, mixer, onEmoteEnd])

  return (
    <group ref={groupRef}>
      <primitive object={walkFBX} scale={0.01} position={[0, 0, 0]} />
      {name ? (
        <Billboard position={[0, 2.4, 0]}>
          <Text fontSize={0.2} color="#facc15" anchorX="center" anchorY="middle">★ {name}</Text>
          <Text fontSize={0.12} color="#facc15" anchorX="center" anchorY="middle" position={[0, -0.27, 0]}>• You</Text>
        </Billboard>
      ) : null}
    </group>
  )
}
