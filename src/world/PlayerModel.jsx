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

// Map a Mixamo bone name to a clothing region.
// Priority matters: more-specific checks come first.
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
  return 'shirt'   // spine, shoulder, chest, clavicle → shirt
}

const _pantsC = new THREE.Color('#1c1c2e')
const _shoeC  = new THREE.Color('#120e08')

// Paint per-vertex colours onto a SkinnedMesh using skinning weights.
// The dominant bone for each vertex determines which region (shirt/pants/shoe/skin) it belongs to.
function paintClothing(mesh, skinHex, outfitHex) {
  const geo   = mesh.geometry
  const bones = mesh.skeleton?.bones

  // Fallback if no skinning data (shouldn't happen with standard Mixamo FBX)
  if (!bones || !geo.attributes.skinIndex) {
    mesh.material = new THREE.MeshToonMaterial({
      color:    skinHex,
      emissive: new THREE.Color(0.06, 0.06, 0.08),
    })
    mesh.castShadow = true
    return
  }

  const si    = geo.attributes.skinIndex
  const sw    = geo.attributes.skinWeight
  const count = geo.attributes.position.count

  const skinC   = new THREE.Color(skinHex)
  const outfitC = new THREE.Color(outfitHex)

  // Reuse existing buffer if possible; otherwise allocate fresh
  let attr = geo.attributes.color
  let arr
  if (attr && attr.count === count) {
    arr = attr.array
  } else {
    arr = new Float32Array(count * 3)
  }

  for (let i = 0; i < count; i++) {
    // Find the bone with the highest influence on this vertex
    let maxW = -1, domIdx = 0
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(i, j)
      if (w > maxW) { maxW = w; domIdx = si.getComponent(i, j) }
    }
    const bone = bones[domIdx]
    const region = bone ? boneRegion(bone.name) : 'shirt'

    const c =
      region === 'skin'  ? skinC :
      region === 'pants' ? _pantsC :
      region === 'shoe'  ? _shoeC :
      outfitC

    arr[i * 3]     = c.r
    arr[i * 3 + 1] = c.g
    arr[i * 3 + 2] = c.b
  }

  if (attr && attr.count === count) {
    attr.needsUpdate = true
  } else {
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  }

  // Create or reuse a toon material with vertex colours.
  // A small emissive ensures the character stays visible at night
  // (ambient can drop to 0.04 intensity) without looking glowing in daylight.
  if (!mesh.material?.vertexColors) {
    mesh.material = new THREE.MeshToonMaterial({
      vertexColors: true,
      emissive:     new THREE.Color(0.07, 0.07, 0.09),
    })
  }
  mesh.castShadow = true
}

export default function PlayerModel({
  walking = false,
  running  = false,
  name     = '',
  outfit   = 'casual',
  skin     = '#F4C08A',
}) {
  const groupRef = useRef()

  const rawWalkFBX = useFBX('/models/Walking.fbx')
  const rawIdleFBX = useFBX('/models/Standing_Idle.fbx')

  // Clone the cached FBX AND deep-clone each SkinnedMesh geometry so this
  // instance can write its own vertex colours without affecting the cache or other instances.
  const walkFBX = useMemo(() => {
    const clone = SkeletonUtils.clone(rawWalkFBX)
    clone.traverse(c => { if (c.isSkinnedMesh) c.geometry = c.geometry.clone() })
    return clone
  }, [rawWalkFBX])

  const outfitColor = OUTFIT_COLORS[outfit] || OUTFIT_COLORS.casual

  // Paint vertex colours for clothing regions whenever skin/outfit changes.
  useEffect(() => {
    walkFBX.traverse(child => {
      if (child.isSkinnedMesh) paintClothing(child, skin, outfitColor)
    })
  }, [walkFBX, skin, outfitColor])

  // Animation clips from the raw cached originals (not the clone)
  const clips = useMemo(() => {
    const result = []
    if (rawWalkFBX.animations[0]) {
      const clip = rawWalkFBX.animations[0].clone()
      clip.name  = 'Walking'
      // Strip root-motion X/Z so character doesn't slide
      for (const track of clip.tracks) {
        const ln = track.name.toLowerCase()
        if ((ln.includes('hips') || ln.includes('hip')) && ln.endsWith('.position')) {
          for (let i = 0; i < track.values.length; i += 3) {
            track.values[i]     = 0
            track.values[i + 2] = 0
          }
        }
      }
      result.push(clip)
    }
    if (rawIdleFBX.animations[0]) {
      const clip = rawIdleFBX.animations[0].clone()
      clip.name  = 'Idle'
      result.push(clip)
    }
    return result
  }, [rawWalkFBX, rawIdleFBX])

  const { actions } = useAnimations(clips, groupRef)

  useEffect(() => {
    if (actions['Idle']) actions['Idle'].reset().play()
  }, [actions])

  const isMoving = walking || running
  useEffect(() => {
    const idle = actions['Idle']
    const walk = actions['Walking']
    if (!idle || !walk) return
    if (isMoving) { idle.fadeOut(0.2); walk.reset().fadeIn(0.2).play() }
    else          { walk.fadeOut(0.3); idle.reset().fadeIn(0.3).play() }
  }, [isMoving, actions])

  useEffect(() => {
    if (actions['Walking']) actions['Walking'].timeScale = running ? 1.6 : 1.0
  }, [running, actions])

  return (
    <group ref={groupRef}>
      <primitive object={walkFBX} scale={0.01} position={[0, 0, 0]} />
      {name ? (
        <Billboard position={[0, 2.4, 0]}>
          <Text fontSize={0.2} color="#facc15" anchorX="center" anchorY="middle">
            ★ {name}
          </Text>
          <Text fontSize={0.12} color="#facc15" anchorX="center" anchorY="middle" position={[0, -0.27, 0]}>
            • You
          </Text>
        </Billboard>
      ) : null}
    </group>
  )
}
