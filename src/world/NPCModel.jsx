import React, { useRef, useEffect, useMemo } from 'react'
import { useFBX, useAnimations, Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
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
  if (n.includes('toe')    || n.includes('foot'))                               return 'shoe'
  if (n.includes('upleg')  || n.includes('leg'))                                return 'pants'
  if (n.includes('hip'))                                                        return 'pants'
  if (n.includes('forearm')|| n.includes('fore_arm') || n.includes('lowerarm')) return 'skin'
  if (n.includes('hand')   || n.includes('finger')   || n.includes('thumb')    ||
      n.includes('index')  || n.includes('middle')   || n.includes('ring')     || n.includes('pinky')) return 'skin'
  if (n.includes('arm'))                                                        return 'shirt'
  if (n.includes('head')   || n.includes('neck'))                               return 'skin'
  return 'shirt'
}

const _pantsC = new THREE.Color('#1c1c2e')
const _shoeC  = new THREE.Color('#120e08')

function paintClothing(mesh, skinHex, outfitHex) {
  const geo   = mesh.geometry
  const bones = mesh.skeleton?.bones

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

  let attr = geo.attributes.color
  let arr
  if (attr && attr.count === count) {
    arr = attr.array
  } else {
    arr = new Float32Array(count * 3)
  }

  for (let i = 0; i < count; i++) {
    let maxW = -1, domIdx = 0
    for (let j = 0; j < 4; j++) {
      const w = sw.getComponent(i, j)
      if (w > maxW) { maxW = w; domIdx = si.getComponent(i, j) }
    }
    const bone   = bones[domIdx]
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

  if (!mesh.material?.vertexColors) {
    mesh.material = new THREE.MeshToonMaterial({
      vertexColors: true,
      emissive:     new THREE.Color(0.07, 0.07, 0.09),
    })
  }
  mesh.castShadow = true
}

function NPCModel({
  outfit        = 'casual',
  skin          = '#F4C08A',
  walking       = false,
  name          = '',
  labelColor    = '#facc15',
  sublabel      = '',
  sublabelColor = '#f59e0b',
  npcScale      = 0.01,
  onClick       = null,
  visibleRef    = null,
}) {
  const groupRef = useRef()

  const rawWalkFBX = useFBX('/models/Walking.fbx')
  const rawIdleFBX = useFBX('/models/Standing_Idle.fbx')

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
      clip.name  = 'Walking'
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

  const { actions, mixer } = useAnimations(clips, groupRef)

  // Pause animation mixer when this NPC is distance-culled — saves CPU for invisible NPCs
  useFrame(() => {
    if (mixer) mixer.timeScale = (visibleRef && visibleRef.current === false) ? 0 : 1
  })

  useEffect(() => {
    if (actions['Idle']) actions['Idle'].reset().play()
  }, [actions])

  useEffect(() => {
    const idle = actions['Idle']
    const walk = actions['Walking']
    if (!idle || !walk) return
    if (walking) { idle.fadeOut(0.2); walk.reset().fadeIn(0.2).play() }
    else         { walk.fadeOut(0.3); idle.reset().fadeIn(0.3).play() }
  }, [walking, actions])

  return (
    <group ref={groupRef} onClick={onClick}>
      <primitive object={walkFBX} scale={npcScale} position={[0, 0, 0]} />
      <Billboard position={[0, 2.4, 0]}>
        <Text fontSize={0.18} color={labelColor} anchorX="center" anchorY="middle">
          {name}
        </Text>
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
