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

function attachToBone(root, search, geo, color, pos) {
  let bone = null
  root.traverse(obj => {
    if (!bone && obj.isBone && obj.name.toLowerCase().includes(search.toLowerCase())) bone = obj
  })
  if (!bone) return null
  const mesh = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: new THREE.Color(color) }))
  mesh.castShadow = true
  mesh.position.set(...pos)
  mesh.name = '__clothing__'
  bone.add(mesh)
  return { bone, mesh }
}

export default function NPCModel({
  outfit     = 'casual',
  skin       = '#F4C08A',
  walking    = false,
  name       = '',
  labelColor = '#facc15',
  npcScale   = 0.01,
  onClick    = null,
}) {
  const groupRef = useRef()

  // Load cached FBX assets (shared across all NPC instances)
  const rawWalkFBX = useFBX('/models/Walking.fbx')
  const rawIdleFBX = useFBX('/models/Standing_Idle.fbx')

  // Each NPC needs its OWN skeleton clone so animations are independent
  const walkFBX = useMemo(() => SkeletonUtils.clone(rawWalkFBX), [rawWalkFBX])

  const outfitColor = OUTFIT_COLORS[outfit] || OUTFIT_COLORS.casual

  // Apply per-NPC skin color and clothing
  useEffect(() => {
    const skinMat = new THREE.MeshToonMaterial({ color: new THREE.Color(skin) })
    walkFBX.traverse(child => {
      if (child.isSkinnedMesh || child.isMesh) {
        child.castShadow = true
        child.material   = skinMat
      }
    })

    const attachments = []

    const shirt = attachToBone(
      walkFBX, 'Spine2',
      new THREE.CylinderGeometry(13, 15, 55, 8),
      outfitColor, [0, -10, 0],
    ) || attachToBone(
      walkFBX, 'Spine1',
      new THREE.CylinderGeometry(13, 15, 55, 8),
      outfitColor, [0, -8, 0],
    )
    if (shirt) attachments.push(shirt)

    const leftPant = attachToBone(
      walkFBX, 'LeftUpLeg',
      new THREE.CylinderGeometry(10, 9, 40, 7),
      '#1a1a2e', [0, -18, 0],
    )
    if (leftPant) attachments.push(leftPant)

    const rightPant = attachToBone(
      walkFBX, 'RightUpLeg',
      new THREE.CylinderGeometry(10, 9, 40, 7),
      '#1a1a2e', [0, -18, 0],
    )
    if (rightPant) attachments.push(rightPant)

    const leftShoe = attachToBone(
      walkFBX, 'LeftFoot',
      new THREE.BoxGeometry(9, 5, 15),
      '#111111', [0, -2, 8],
    )
    if (leftShoe) attachments.push(leftShoe)

    const rightShoe = attachToBone(
      walkFBX, 'RightFoot',
      new THREE.BoxGeometry(9, 5, 15),
      '#111111', [0, -2, 8],
    )
    if (rightShoe) attachments.push(rightShoe)

    return () => {
      attachments.forEach(({ bone, mesh }) => {
        bone.remove(mesh)
        mesh.geometry.dispose()
        if (mesh.material.dispose) mesh.material.dispose()
      })
    }
  }, [walkFBX, outfitColor, skin])

  // Animation clips cloned from the shared cached originals
  const clips = useMemo(() => {
    const result = []

    if (rawWalkFBX.animations[0]) {
      const clip = rawWalkFBX.animations[0].clone()
      clip.name  = 'Walking'
      for (const track of clip.tracks) {
        const lname = track.name.toLowerCase()
        if ((lname.includes('hips') || lname.includes('hip')) && lname.endsWith('.position')) {
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

  useEffect(() => {
    const idle = actions['Idle']
    const walk = actions['Walking']
    if (!idle || !walk) return
    if (walking) {
      idle.fadeOut(0.2)
      walk.reset().fadeIn(0.2).play()
    } else {
      walk.fadeOut(0.3)
      idle.reset().fadeIn(0.3).play()
    }
  }, [walking, actions])

  return (
    <group ref={groupRef} onClick={onClick}>
      <primitive object={walkFBX} scale={npcScale} position={[0, 0, 0]} />
      <Billboard position={[0, 2.4, 0]}>
        <Text fontSize={0.18} color={labelColor} anchorX="center" anchorY="middle">
          {name}
        </Text>
      </Billboard>
    </group>
  )
}
