import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import PlayerModel from './PlayerModel'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'

// ── Primitive furniture helpers ───────────────────────────────────────────
function Box({ pos, w=1, h=1, d=1, color='#334155', outline=true }) {
  return (
    <group position={pos}>
      <mesh position={[0, h/2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshToonMaterial color={color} />
      </mesh>
      {outline && (
        <mesh position={[0, h/2, 0]} scale={[1.04, 1.03, 1.04]}>
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial color="#000" side={THREE.BackSide} />
        </mesh>
      )}
    </group>
  )
}
function Sofa({ pos, rot=0, color='#7c3aed', w=2.2 }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <Box pos={[0, 0, 0]}   w={w} h={0.45} d={0.9}  color={color} />
      <Box pos={[0, 0, -0.4]} w={w} h={0.75} d={0.12} color={color} />
      <Box pos={[-w/2+0.1, 0, 0]} w={0.12} h={0.6} d={0.9} color={color} />
      <Box pos={[ w/2-0.1, 0, 0]} w={0.12} h={0.6} d={0.9} color={color} />
    </group>
  )
}
function Table({ pos, w=1.2, d=0.7, h=0.75, color='#92400e' }) {
  return (
    <group position={pos}>
      <Box pos={[0, 0, 0]} w={w} h={0.07} d={d} color={color} />
      {[[-w/2+0.1,0,-d/2+0.1],[w/2-0.1,0,-d/2+0.1],[-w/2+0.1,0,d/2-0.1],[w/2-0.1,0,d/2-0.1]].map(([x,,z],i)=>(
        <mesh key={i} position={[x, -h/2, z]}>
          <cylinderGeometry args={[0.04, 0.04, h, 5]} />
          <meshToonMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}
function Chair({ pos, rot=0, color='#334155' }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <Box pos={[0, 0.22, 0]}  w={0.46} h={0.07} d={0.46} color={color} />
      <Box pos={[0, 0.22,-0.2]} w={0.46} h={0.5}  d={0.07} color={color} />
      {[[-0.18,0,0.18],[0.18,0,0.18],[-0.18,0,-0.18],[0.18,0,-0.18]].map(([x,,z],i)=>(
        <mesh key={i} position={[x, 0.11, z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.44, 4]} />
          <meshToonMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}
function Counter({ pos, w=3, d=0.8, h=1.0, color='#1e293b' }) {
  return <Box pos={pos} w={w} h={h} d={d} color={color} />
}
function Shelf({ pos, w=2, h=2.5, d=0.35, color='#7c4a1e' }) {
  return (
    <group position={pos}>
      <Box pos={[0, 0, 0]}    w={w} h={h}    d={d} color={color} />
      {[0.5, 1.1, 1.7, 2.3].map((y,i) => (
        <Box key={i} pos={[0, y, 0.01]} w={w-0.06} h={0.06} d={d+0.02} color="#5c3a1e" outline={false} />
      ))}
    </group>
  )
}
function Bed({ pos, rot=0, color='#3b82f6' }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <Box pos={[0, 0, 0]}    w={1.6} h={0.35} d={2.2} color="#e2e8f0" />
      <Box pos={[0, 0.35, 0]} w={1.5} h={0.18} d={2.0} color={color} />
      <Box pos={[0, 0.35, -0.95]} w={1.4} h={0.22} d={0.3} color="#f8fafc" />
      <Box pos={[0, 0, -0.95]} w={1.6} h={0.55} d={0.14} color="#d1d5db" />
    </group>
  )
}
function TVScreen({ pos, w=1.6, h=1.0 }) {
  return (
    <group position={pos}>
      <Box pos={[0, 0, 0]} w={w+0.1} h={h+0.1} d={0.08} color="#111827" />
      <mesh position={[0, 0, 0.05]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color="#1e3a5f" />
      </mesh>
      <mesh position={[0, -h/2-0.15, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 5]} />
        <meshToonMaterial color="#374151" />
      </mesh>
    </group>
  )
}
function ArcadeMachine({ pos, color='#7c3aed' }) {
  return (
    <group position={pos}>
      <Box pos={[0, 1.0, 0]}  w={0.7} h={1.8} d={0.55} color={color} />
      <mesh position={[0, 1.4, 0.28]}>
        <planeGeometry args={[0.5, 0.42]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0, 1.02, 0.29]}>
        <planeGeometry args={[0.45, 0.14]} />
        <meshBasicMaterial color="#111" />
      </mesh>
    </group>
  )
}
function BeachChair({ pos, rot=0 }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <Box pos={[0, 0.16, 0]}   w={0.7} h={0.06} d={1.6} color="#fde68a" />
      <Box pos={[0, 0.4, -0.7]} w={0.7} h={0.5}  d={0.06} color="#fde68a" />
      <Box pos={[0, 0.08, 0]}   w={0.6} h={0.04} d={1.5} color="#f59e0b" outline={false} />
    </group>
  )
}
function Umbrella({ pos, color='#ef4444' }) {
  return (
    <group position={pos}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3, 5]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[0, 3.05, 0]}>
        <coneGeometry args={[1.1, 0.55, 8]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  )
}

// ── Room shell ────────────────────────────────────────────────────────────
function Room({ w=16, depth=14, wallColor='#f1f5f9', floorColor='#e2e8f0', ceilColor='#f8fafc' }) {
  const hw = w/2, hd = depth/2
  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[w, depth]} />
        <meshToonMaterial color={floorColor} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 3.6, 0]}>
        <planeGeometry args={[w, depth]} />
        <meshToonMaterial color={ceilColor} />
      </mesh>
      {/* North */}
      <mesh position={[0, 1.8, -hd]}>
        <planeGeometry args={[w, 3.6]} />
        <meshToonMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      {/* South (has door gap) */}
      <mesh position={[-hw/2 + 1, 1.8, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[hw-2, 3.6]} />
        <meshToonMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[hw/2 - 1, 1.8, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[hw-2, 3.6]} />
        <meshToonMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      {/* Door top strip */}
      <mesh position={[0, 3.1, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4, 0.5]} />
        <meshToonMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      {/* West */}
      <mesh position={[-hw, 1.8, 0]} rotation={[0, Math.PI/2, 0]}>
        <planeGeometry args={[depth, 3.6]} />
        <meshToonMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
      {/* East */}
      <mesh position={[hw, 1.8, 0]} rotation={[0, -Math.PI/2, 0]}>
        <planeGeometry args={[depth, 3.6]} />
        <meshToonMaterial color={wallColor} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

// ── Exit door arch ────────────────────────────────────────────────────────
function ExitDoor({ hd, isNear }) {
  const ringRef = useRef()
  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.material.opacity = 0.4 + Math.sin(clock.elapsedTime * 2) * 0.25
  })
  return (
    <group position={[0, 0, hd - 0.05]}>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[2.2, 2.8, 0.08]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.25} />
      </mesh>
      <mesh ref={ringRef} position={[0, 1.4, 0]}>
        <torusGeometry args={[1.1, 0.06, 6, 16, Math.PI]} />
        <meshBasicMaterial color={isNear ? '#facc15' : '#7c3aed'} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

// ── Interactable object (glowing sphere) ──────────────────────────────────
function InteractableProp({ pos, name, emoji, isNear }) {
  const ringRef = useRef()
  const bobRef  = useRef()
  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.material.opacity = 0.3 + Math.sin(clock.elapsedTime * 2.5) * 0.25
    if (bobRef.current) bobRef.current.position.y = pos[1] + 1.8 + Math.sin(clock.elapsedTime * 2) * 0.08
  })
  return (
    <group>
      <mesh ref={ringRef} rotation={[-Math.PI/2, 0, 0]} position={[pos[0], 0.03, pos[2]]}>
        <ringGeometry args={[0.55, 0.75, 18]} />
        <meshBasicMaterial color={isNear ? '#facc15' : '#7c3aed'} transparent opacity={0.4} />
      </mesh>
      <group ref={bobRef} position={[pos[0], pos[1]+1.8, pos[2]]}>
        <mesh>
          <sphereGeometry args={[0.18, 8, 6]} />
          <meshBasicMaterial color={isNear ? '#facc15' : '#a78bfa'} />
        </mesh>
        <Billboard>
          <Text fontSize={0.22} anchorX="center" position={[0, 0.32, 0]}>{emoji}</Text>
          {isNear && <Text fontSize={0.13} color="#facc15" anchorX="center" position={[0, -0.22, 0]}>Press F</Text>}
        </Billboard>
      </group>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BUILDING INTERIORS
// ═══════════════════════════════════════════════════════════════════════════

function BeachClubInterior() {
  return (
    <>
      <Room w={20} depth={16} wallColor="#fde68a" floorColor="#f0c060" ceilColor="#fef3c7" />
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 3]} intensity={1.0} color="#FFF8DC" />
      {/* Tiki bar */}
      <Counter pos={[0, 0, -6.5]} w={7} d={1} h={1.05} color="#7c4a1e" />
      <Box pos={[0, 1.05, -6.1]} w={7.4} h={0.08} d={0.4} color="#92400e" />
      {/* Bottles on bar */}
      {[-2.5,-1,0,1,2.5].map((x,i)=>(
        <mesh key={i} position={[x, 1.35, -6.4]}>
          <cylinderGeometry args={[0.06, 0.08, 0.45, 7]} />
          <meshToonMaterial color={['#3b82f6','#22c55e','#ef4444','#f59e0b','#a855f7'][i]} />
        </mesh>
      ))}
      {/* Beach chairs + umbrellas */}
      <BeachChair pos={[-6, 0,  1]} rot={0.3} />
      <Umbrella   pos={[-6, 0, -1]} color="#ef4444" />
      <BeachChair pos={[ 6, 0,  1]} rot={-0.3} />
      <Umbrella   pos={[ 6, 0, -1]} color="#3b82f6" />
      <BeachChair pos={[-4, 0,  3]} />
      <BeachChair pos={[ 4, 0,  3]} />
      {/* Stage */}
      <Box pos={[0, 0, -6.5]} w={4} h={0.3} d={3} color="#fbbf24" />
      {/* String lights on ceiling */}
      {[-7,-3.5,0,3.5,7].map((x,i)=>(
        <mesh key={i} position={[x, 3.45, 0]}>
          <sphereGeometry args={[0.08, 5, 4]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
      ))}
    </>
  )
}

function CafeInterior() {
  return (
    <>
      <Room w={14} depth={12} wallColor="#fef3c7" floorColor="#d97706" ceilColor="#fde68a" />
      <ambientLight intensity={0.85} />
      <directionalLight position={[4, 7, 2]} intensity={0.9} color="#fff8e7" />
      {/* Coffee bar */}
      <Counter pos={[0, 0, -4.5]} w={8} d={0.9} h={1.1} color="#7c4a1e" />
      <Box pos={[0, 1.1, -4.1]} w={8.4} h={0.08} d={0.35} color="#92400e" />
      {/* Espresso machine */}
      <Box pos={[-1, 1.1, -4.5]} w={0.7} h={0.6} d={0.45} color="#374151" />
      <Box pos={[1, 1.1, -4.5]}  w={0.5} h={0.45} d={0.4}  color="#1f2937" />
      {/* Tables */}
      <Table pos={[-3, 0.75, -1]} w={1.0} d={1.0} />
      <Chair pos={[-3.6, 0, -1]} rot={0.5} />
      <Chair pos={[-2.4, 0, -1]} rot={-0.5} />
      <Table pos={[ 3, 0.75, -1]} />
      <Chair pos={[3.6, 0, -1]} rot={0.5} />
      <Chair pos={[2.4, 0, -1]} rot={-0.5} />
      <Table pos={[0, 0.75, 2]} />
      <Chair pos={[-0.6, 0, 2]} />
      <Chair pos={[ 0.6, 0, 2]} />
      {/* Chalkboard menu */}
      <mesh position={[-5.5, 2, -3]}>
        <planeGeometry args={[2, 1.4]} />
        <meshBasicMaterial color="#1c1917" />
      </mesh>
      {/* Shelf with cups */}
      <Box pos={[5.5, 1.8, -3]} w={0.2} h={1.2} d={2} color="#7c4a1e" />
    </>
  )
}

function ArcadeInterior() {
  return (
    <>
      <Room w={18} depth={14} wallColor="#0f0a1e" floorColor="#1a0a2e" ceilColor="#0d0820" />
      <ambientLight intensity={0.4} color="#7c3aed" />
      <pointLight position={[-5, 3, -4]} intensity={1.2} color="#a855f7" distance={12} />
      <pointLight position={[5, 3, -4]}  intensity={1.2} color="#06b6d4" distance={12} />
      {/* Arcade machines row */}
      <ArcadeMachine pos={[-6, 0, -5]} color="#7c3aed" />
      <ArcadeMachine pos={[-3, 0, -5]} color="#ec4899" />
      <ArcadeMachine pos={[ 0, 0, -5]} color="#06b6d4" />
      <ArcadeMachine pos={[ 3, 0, -5]} color="#22c55e" />
      <ArcadeMachine pos={[ 6, 0, -5]} color="#f59e0b" />
      {/* Side machines */}
      <ArcadeMachine pos={[-7, 0, -1]} color="#ef4444" />
      <ArcadeMachine pos={[ 7, 0, -1]} color="#3b82f6" />
      {/* Counter */}
      <Counter pos={[0, 0, 5.5]} w={6} d={0.8} h={1.0} color="#1e1b4b" />
      {/* Neon strips */}
      {[-8,-4,0,4,8].map((x,i)=>(
        <mesh key={i} position={[x, 3.4, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 14, 4]} rotation={[0,0,Math.PI/2]} />
          <meshBasicMaterial color={['#a855f7','#06b6d4','#ec4899','#22c55e','#f59e0b'][i]} />
        </mesh>
      ))}
    </>
  )
}

function RooftopInterior() {
  return (
    <>
      {/* Open rooftop — no ceiling, city backdrop */}
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[18, 14]} />
        <meshToonMaterial color="#1e1b4b" />
      </mesh>
      <ambientLight intensity={0.5} color="#1a0a4e" />
      <pointLight position={[0, 6, 0]} intensity={1.0} color="#a78bfa" distance={20} />
      {/* Walls — only 3 sides (open bar feel) */}
      {[[-9,0,0,Math.PI/2],[9,0,0,-Math.PI/2],[0,0,-7,0]].map(([x,y,z,ry],i)=>(
        <mesh key={i} position={[x, 1.8, z]} rotation={[0, ry, 0]}>
          <planeGeometry args={[i===2?18:14, 3.6]} />
          <meshToonMaterial color="#1e293b" side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Bar */}
      <Counter pos={[0, 0, -5]} w={8} d={0.9} h={1.1} color="#0f172a" />
      {/* High tables */}
      <Box pos={[-4, 0, 0]} w={0.8} h={1.0} d={0.8} color="#334155" />
      <Box pos={[ 4, 0, 0]} w={0.8} h={1.0} d={0.8} color="#334155" />
      <Box pos={[-4, 0, 3]} w={0.8} h={1.0} d={0.8} color="#334155" />
      <Box pos={[ 4, 0, 3]} w={0.8} h={1.0} d={0.8} color="#334155" />
      {/* String lights */}
      {[-7,-3.5,0,3.5,7].map((x,i)=>(
        <mesh key={i} position={[x, 3.3, 0]}>
          <sphereGeometry args={[0.1, 5, 4]} />
          <meshBasicMaterial color="#fef9c3" />
        </mesh>
      ))}
      {/* City skyline backdrop */}
      {[-6,-3,0,3,6].map((x,i)=>(
        <Box key={i} pos={[x, 0, -6.9]} w={1.2} h={[3,5,4,5.5,2.5][i]} d={0.2}
          color={['#1e293b','#0f172a','#1e293b','#0f172a','#1e293b'][i]} outline={false} />
      ))}
    </>
  )
}

function MusicRoomInterior() {
  return (
    <>
      <Room w={14} depth={12} wallColor="#1a0a2e" floorColor="#0d0820" ceilColor="#120832" />
      <ambientLight intensity={0.5} color="#5b21b6" />
      <pointLight position={[0, 4, 0]} intensity={1.2} color="#c4b5fd" distance={18} />
      {/* Acoustic foam pattern */}
      {[-5,-3,-1,1,3,5].map(x=>[-3,-1,1,3].map((z,j)=>(
        <mesh key={`${x}${j}`} position={[x, 1.8, -5.9]} rotation={[0,Math.PI,0]}>
          <boxGeometry args={[0.8, 0.8, 0.15]} />
          <meshToonMaterial color={j%2===0?'#1e1b4b':'#2e1065'} />
        </mesh>
      )))}
      {/* Piano */}
      <Box pos={[-4, 0, -3]} w={1.6} h={0.8} d={0.7} color="#111827" />
      <mesh position={[-4, 0.82, -2.8]}>
        <planeGeometry args={[1.4, 0.18]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      {/* Guitar on wall */}
      <mesh position={[4.5, 2.2, -5.4]} rotation={[0, Math.PI, 0.3]}>
        <capsuleGeometry args={[0.2, 0.7, 4, 8]} />
        <meshToonMaterial color="#92400e" />
      </mesh>
      {/* Drum kit */}
      <mesh position={[3, 0.3, -2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.28, 10]} />
        <meshToonMaterial color="#ef4444" />
      </mesh>
      <mesh position={[3.7, 0.3, -2.4]}>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 10]} />
        <meshToonMaterial color="#ef4444" />
      </mesh>
      {/* Mixing desk */}
      <Box pos={[-1, 0, 1]} w={2} h={0.7} d={0.9} color="#1f2937" />
      <mesh position={[-1, 0.72, 0.8]}>
        <planeGeometry args={[1.8, 0.5]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      {/* Microphone stand */}
      <mesh position={[1, 1, -1]}>
        <cylinderGeometry args={[0.025, 0.025, 1.8, 5]} />
        <meshToonMaterial color="#9ca3af" />
      </mesh>
    </>
  )
}

function CityHallInterior() {
  return (
    <>
      <Room w={22} depth={18} wallColor="#f8fafc" floorColor="#e2e8f0" ceilColor="#f1f5f9" />
      <ambientLight intensity={1.0} />
      <directionalLight position={[0, 8, 0]} intensity={0.8} color="#fffde7" />
      {/* Marble floor pattern */}
      {[-8,-4,0,4,8].map(x=>[-7,-3.5,0,3.5,7].map((z,j)=>(
        <mesh key={`${x}${j}`} rotation={[-Math.PI/2,0,0]} position={[x, 0.01, z]}>
          <planeGeometry args={[3.8, 3.4]} />
          <meshBasicMaterial color={j%2===0?'#f8fafc':'#e2e8f0'} />
        </mesh>
      )))}
      {/* Columns */}
      {[-8,-4,4,8].map((x,i)=>(
        <mesh key={i} position={[x, 1.8, -6]}>
          <cylinderGeometry args={[0.28, 0.32, 3.6, 8]} />
          <meshToonMaterial color="#e2e8f0" />
        </mesh>
      ))}
      {/* Reception desk */}
      <Counter pos={[0, 0, 3]} w={8} d={1.2} h={1.1} color="#cbd5e1" />
      <Box pos={[0, 1.1, 3.1]} w={8.4} h={0.09} d={0.5} color="#94a3b8" />
      {/* Chairs in waiting area */}
      {[-3,0,3].map((x,i)=>(
        <Chair key={i} pos={[x, 0, 6]} color="#94a3b8" />
      ))}
      {/* Flag */}
      <mesh position={[-9, 1, -8]}>
        <cylinderGeometry args={[0.04, 0.04, 3.5, 5]} />
        <meshToonMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[-8, 2.8, -8]}>
        <planeGeometry args={[1.4, 0.8]} />
        <meshToonMaterial color="#ef4444" side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

function MallInterior() {
  return (
    <>
      <Room w={22} depth={18} wallColor="#fce7f3" floorColor="#fbcfe8" ceilColor="#fdf2f8" />
      <ambientLight intensity={1.0} />
      <directionalLight position={[0, 10, 0]} intensity={0.9} color="#ffe4f0" />
      {/* Central fountain */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[1.6, 1.9, 0.5, 14]} />
        <meshToonMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[1.3, 1.3, 0.08, 14]} />
        <meshToonMaterial color="#38bdf8" transparent opacity={0.8} />
      </mesh>
      {/* Shop fronts */}
      {[-7,-7,7,7].map((x,i)=>(
        <group key={i} position={[x, 0, [-5,-1,-5,-1][i]]}>
          <Box pos={[0, 0, 0]} w={0.2} h={3} d={4} color={['#fce7f3','#ede9fe','#fce7f3','#ede9fe'][i]} />
          <mesh position={[0.15, 1.5, 0]}>
            <planeGeometry args={[3.5, 2.4]} />
            <meshBasicMaterial color={['#fbcfe8','#ddd6fe','#fbcfe8','#ddd6fe'][i]} transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
      {/* Benches */}
      {[-4,4].map((x,i)=>(
        <Box key={i} pos={[x, 0.38, 0]} w={0.4} h={0.38} d={2} color="#e879f9" />
      ))}
      {/* Info kiosk */}
      <Box pos={[0, 0, 5]} w={1.2} h={1.3} d={1.2} color="#a855f7" />
    </>
  )
}

function CinemaInterior() {
  return (
    <>
      <Room w={20} depth={18} wallColor="#0f0a1e" floorColor="#1a0534" ceilColor="#0d0820" />
      <ambientLight intensity={0.3} color="#1a0534" />
      <pointLight position={[0, 5, -7]} intensity={0.8} color="#fff" distance={20} />
      {/* Screen */}
      <mesh position={[0, 2.2, -8]}>
        <planeGeometry args={[14, 4.5]} />
        <meshBasicMaterial color="#e0e7ff" />
      </mesh>
      <Box pos={[0, 2.2, -8.1]} w={14.6} h={5.1} d={0.2} color="#111827" />
      {/* Rows of seats */}
      {[0,1,2,3,4].map(row=>(
        [-4,-2,0,2,4].map((x,si)=>(
          <group key={`${row}${si}`} position={[x, row*0.18, -5 + row*1.8]}>
            <Box pos={[0, 0, 0]}    w={0.55} h={0.42} d={0.55} color="#1e1b4b" />
            <Box pos={[0, 0, -0.25]} w={0.55} h={0.55} d={0.08} color="#1e1b4b" />
          </group>
        ))
      ))}
      {/* Popcorn stand */}
      <Counter pos={[-7, 0, 6]} w={3} d={0.9} h={1.0} color="#7c3aed" />
      <mesh position={[-7, 1.4, 6]}>
        <cylinderGeometry args={[0.18, 0.22, 0.5, 8]} />
        <meshToonMaterial color="#ef4444" />
      </mesh>
    </>
  )
}

function SupermarketInterior() {
  return (
    <>
      <Room w={20} depth={14} wallColor="#f0fdf4" floorColor="#dcfce7" ceilColor="#f0fdf4" />
      <ambientLight intensity={1.0} />
      <directionalLight position={[0, 8, 0]} intensity={0.8} />
      {/* Shelving aisles */}
      {[-6,-2,2,6].map((x,col)=>(
        <group key={col} position={[x, 0, -2]}>
          <Shelf pos={[0, 0, -2]} w={1.0} h={2} d={0.35} color={['#7c4a1e','#334155','#7c4a1e','#334155'][col]} />
          <Shelf pos={[0, 0,  0]} w={1.0} h={2} d={0.35} color={['#7c4a1e','#334155','#7c4a1e','#334155'][col]} />
          {/* Products on shelf */}
          {[-0.4,0,0.4].map((z,si)=>(
            <Box key={si} pos={[0.4, 1.1, z]} w={0.18} h={0.22} d={0.15}
              color={['#ef4444','#3b82f6','#22c55e','#f59e0b','#a855f7','#ec4899'][si+(col*2)%6]}
              outline={false} />
          ))}
        </group>
      ))}
      {/* Checkout counters */}
      {[-4,4].map((x,i)=>(
        <Counter key={i} pos={[x, 0, 5]} w={2} d={0.7} h={1.0} color="#16a34a" />
      ))}
      {/* Produce section */}
      <Box pos={[0, 0.35, 5]} w={4} h={0.35} d={1.2} color="#15803d" />
      {[-1.2,-0.4,0.4,1.2].map((x,i)=>(
        <mesh key={i} position={[x, 0.72, 5]}>
          <sphereGeometry args={[0.16, 6, 5]} />
          <meshToonMaterial color={['#ef4444','#22c55e','#f59e0b','#a855f7'][i]} />
        </mesh>
      ))}
    </>
  )
}

function BankInterior() {
  return (
    <>
      <Room w={16} depth={12} wallColor="#f8f4e8" floorColor="#fef3c7" ceilColor="#fffbeb" />
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 2]} intensity={0.8} color="#fffde7" />
      {/* Teller windows */}
      {[-4,0,4].map((x,i)=>(
        <group key={i} position={[x, 0, -4]}>
          <Box pos={[0, 0, 0]} w={2.2} h={1.0} d={0.6} color="#fef3c7" />
          <mesh position={[0, 1.4, 0.15]}>
            <planeGeometry args={[1.8, 0.8]} />
            <meshBasicMaterial color="#bfdbfe" transparent opacity={0.7} />
          </mesh>
          <Box pos={[0, 1.0, 0]} w={2.2} h={0.08} d={0.5} color="#b45309" />
        </group>
      ))}
      {/* Waiting area */}
      <Sofa pos={[-3, 0, 3]} color="#b45309" w={2.0} />
      <Sofa pos={[ 3, 0, 3]} color="#b45309" w={2.0} />
      {/* Velvet rope */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 8, 5]} rotation={[0, 0, Math.PI/2]} />
        <meshToonMaterial color="#b45309" />
      </mesh>
      {/* ATM */}
      <Box pos={[6.5, 0, 2]} w={0.65} h={1.6} d={0.5} color="#374151" />
      <mesh position={[6.5, 1.3, 2.28]}>
        <planeGeometry args={[0.5, 0.4]} />
        <meshBasicMaterial color="#1e40af" />
      </mesh>
      {/* Vault door */}
      <Box pos={[-6.5, 0, -4.5]} w={0.18} h={2.2} d={1.8} color="#9ca3af" />
      <mesh position={[-6.4, 1.1, -4.5]}>
        <circleGeometry args={[0.55, 16]} />
        <meshBasicMaterial color="#6b7280" />
      </mesh>
    </>
  )
}

function HospitalInterior() {
  return (
    <>
      <Room w={18} depth={14} wallColor="#f0f9ff" floorColor="#e0f2fe" ceilColor="#f0f9ff" />
      <ambientLight intensity={1.1} color="#f0f9ff" />
      <directionalLight position={[0, 8, 0]} intensity={0.9} color="#e0f2fe" />
      {/* Nurse station */}
      <Counter pos={[0, 0, 1]} w={7} d={1.0} h={1.1} color="#0ea5e9" />
      <Box pos={[0, 1.1, 0.6]} w={7.4} h={0.08} d={0.4} color="#38bdf8" />
      {/* Waiting chairs */}
      {[-5,-3,-1,1,3,5].map((x,i)=>(
        <Chair key={i} pos={[x, 0, 5]} color="#bae6fd" />
      ))}
      {/* Examination beds */}
      {[-5, 5].map((x,i)=>(
        <group key={i} position={[x, 0, -4]}>
          <Box pos={[0, 0.3, 0]} w={1.0} h={0.3} d={2.2} color="#f8fafc" />
          <Box pos={[0, 0.3, 0]} w={0.9} h={0.14} d={2.0} color="#e0f2fe" outline={false}/>
          <Box pos={[0, 0, 0]}   w={1.0} h={0.3} d={2.2} color="#e2e8f0" outline={false} />
        </group>
      ))}
      {/* Red cross on north wall */}
      <mesh position={[0, 2.5, -6.9]}>
        <planeGeometry args={[0.35, 1.2]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 2.5, -6.9]}>
        <planeGeometry args={[1.2, 0.35]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </>
  )
}

function PoliceInterior() {
  return (
    <>
      <Room w={14} depth={12} wallColor="#1e3a5f" floorColor="#1e293b" ceilColor="#0f172a" />
      <ambientLight intensity={0.7} color="#93c5fd" />
      <directionalLight position={[0, 6, 0]} intensity={0.8} color="#bfdbfe" />
      {/* Front desk */}
      <Counter pos={[0, 0, 1]} w={6} d={1.0} h={1.2} color="#1d4ed8" />
      <Box pos={[0, 1.2, 0.6]} w={6.4} h={0.08} d={0.4} color="#2563eb" />
      {/* Badge on wall */}
      <mesh position={[0, 2.5, -5.9]}>
        <circleGeometry args={[0.8, 5]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
      <mesh position={[0, 2.5, -5.85]}>
        <circleGeometry args={[0.45, 8]} />
        <meshBasicMaterial color="#1e3a5f" />
      </mesh>
      {/* Desks with chairs */}
      <Table pos={[-3.5, 0.75, -2]} w={1.4} d={0.8} color="#334155" />
      <Chair pos={[-3.5, 0, -1.2]} rot={Math.PI} color="#1d4ed8" />
      <Table pos={[ 3.5, 0.75, -2]} w={1.4} d={0.8} color="#334155" />
      <Chair pos={[3.5, 0, -1.2]}  rot={Math.PI} color="#1d4ed8" />
      {/* Evidence board */}
      <mesh position={[5.9, 2, -2]}>
        <planeGeometry args={[2, 1.8]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} />
      </mesh>
      {/* Blue lights */}
      {[-4,4].map((x,i)=>(
        <mesh key={i} position={[x, 3.4, 0]}>
          <sphereGeometry args={[0.1, 6, 4]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      ))}
    </>
  )
}

function FireStationInterior() {
  return (
    <>
      <Room w={18} depth={14} wallColor="#dc2626" floorColor="#7f1d1d" ceilColor="#991b1b" />
      <ambientLight intensity={0.8} color="#fca5a5" />
      <directionalLight position={[0, 8, 0]} intensity={1.0} />
      {/* Fire truck (big red box) */}
      <Box pos={[0, 0, -3]} w={3.5} h={1.6} d={6} color="#dc2626" />
      <Box pos={[0, 1.6, -1]} w={3.2} h={0.8} d={3} color="#b91c1c" />
      {/* Wheels */}
      {[-1.8,1.8].map((x,i)=>[-4,-1,2].map((z,j)=>(
        <mesh key={`${i}${j}`} position={[x, 0.35, z]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.28, 8]} />
          <meshToonMaterial color="#1a1a1a" />
        </mesh>
      )))}
      {/* Equipment on wall */}
      {[-5,-2,2,5].map((x,i)=>(
        <Box key={i} pos={[x, 1.8, -6.9]} w={0.8} h={1.2} d={0.15}
          color={['#374151','#dc2626','#374151','#dc2626'][i]} />
      ))}
      {/* Briefing table */}
      <Table pos={[0, 0.75, 5]} w={3.5} d={1.5} color="#374151" />
      {[-1,0,1].map((x,i)=><Chair key={i} pos={[x, 0, 4.3]} color="#111827" />)}
    </>
  )
}

function SchoolInterior() {
  return (
    <>
      <Room w={20} depth={14} wallColor="#fde68a" floorColor="#fef9c3" ceilColor="#fffbeb" />
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 8, 2]} intensity={0.9} color="#fffde7" />
      {/* Chalkboard */}
      <mesh position={[0, 2.1, -6.9]}>
        <planeGeometry args={[10, 2.8]} />
        <meshBasicMaterial color="#166534" />
      </mesh>
      <Box pos={[0, 2.1, -6.85]} w={10.4} h={2.9} d={0.1} color="#14532d" />
      {/* Teacher's desk */}
      <Table pos={[0, 0.75, -4]} w={2.2} d={1.0} color="#92400e" />
      <Chair pos={[0, 0, -3.2]} rot={Math.PI} color="#78350f" />
      {/* Student desks */}
      {[-6,-3,0,3,6].map(x=>[-1,1.5].map((z,j)=>(
        <group key={`${x}${j}`} position={[x, 0, z]}>
          <Table pos={[0, 0.65, 0]} w={1.0} d={0.65} color="#fbbf24" />
          <Chair pos={[0, 0, 0.55]} color="#f59e0b" />
        </group>
      )))}
      {/* Bookshelves on side */}
      <Shelf pos={[8.5, 0, -2]} w={0.35} h={2.2} d={3} color="#92400e" />
    </>
  )
}

function LibraryInterior() {
  return (
    <>
      <Room w={18} depth={14} wallColor="#d4b896" floorColor="#c9a87c" ceilColor="#e5cba8" />
      <ambientLight intensity={0.75} color="#fffde7" />
      <directionalLight position={[5, 8, 2]} intensity={0.7} color="#fffde7" />
      {/* Bookshelves */}
      {[-7,-4,-1,2,5].map((x,i)=>(
        <Shelf key={i} pos={[x, 0, -3]} w={1.2} h={2.6} d={0.4} color="#7c4a1e" />
      ))}
      {[-7,-4,-1,2,5].map((x,i)=>(
        <Shelf key={i+5} pos={[x, 0, 0.5]} w={1.2} h={2.6} d={0.4} color="#92400e" />
      ))}
      {/* Reading tables */}
      <Table pos={[-3, 0.75, 4.5]} w={2} d={1} color="#7c4a1e" />
      <Chair pos={[-3.7, 0, 4.5]} color="#5c3a1e" />
      <Chair pos={[-2.3, 0, 4.5]} color="#5c3a1e" />
      <Table pos={[3, 0.75, 4.5]} w={2} d={1} color="#7c4a1e" />
      <Chair pos={[2.3, 0, 4.5]} color="#5c3a1e" />
      <Chair pos={[3.7, 0, 4.5]} color="#5c3a1e" />
      {/* Librarian desk */}
      <Counter pos={[0, 0, -5.5]} w={4} d={0.9} h={1.0} color="#92400e" />
      {/* Reading lamp */}
      <mesh position={[-3, 1.5, 4.5]}>
        <cylinderGeometry args={[0.03, 0.03, 1.0, 5]} />
        <meshToonMaterial color="#374151" />
      </mesh>
      <mesh position={[-3, 1.95, 4.5]}>
        <coneGeometry args={[0.25, 0.3, 7]} rotation={[Math.PI, 0, 0]} />
        <meshToonMaterial color="#fbbf24" />
      </mesh>
    </>
  )
}

function GymInterior() {
  return (
    <>
      <Room w={16} depth={14} wallColor="#1e1b4b" floorColor="#312e81" ceilColor="#1e1b4b" />
      <ambientLight intensity={0.7} color="#c4b5fd" />
      <pointLight position={[0, 4, 0]} intensity={1.2} color="#a78bfa" distance={20} />
      {/* Treadmills */}
      {[-5, 5].map((x,i)=>(
        <group key={i} position={[x, 0, -4]}>
          <Box pos={[0, 0.2, 0]}  w={1.0} h={0.4} d={1.8} color="#1f2937" />
          <Box pos={[0, 0.8, 0.6]} w={0.9} h={0.9} d={0.12} color="#374151" />
          <mesh position={[0, 0.5, 0.7]}>
            <planeGeometry args={[0.8, 0.5]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
        </group>
      ))}
      {/* Weight rack */}
      <Box pos={[0, 0.5, -5.5]} w={5} h={1.0} d={0.6} color="#111827" />
      {[-1.6,-0.8,0,0.8,1.6].map((x,i)=>(
        <mesh key={i} position={[x, 0.8, -5.5]} rotation={[0, 0, Math.PI/2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.18, 8]} />
          <meshToonMaterial color={['#374151','#4b5563','#6b7280','#4b5563','#374151'][i]} />
        </mesh>
      ))}
      {/* Bench press */}
      <Box pos={[-4, 0.36, 1]} w={0.5} h={0.36} d={1.8} color="#1f2937" />
      <mesh position={[-4, 0.9, 0.2]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[0.22, 0.22, 1.6, 8]} />
        <meshToonMaterial color="#374151" />
      </mesh>
      {/* Mirror walls */}
      <mesh position={[0, 1.8, -6.85]}>
        <planeGeometry args={[14, 3.6]} />
        <meshBasicMaterial color="#e0e7ff" transparent opacity={0.35} />
      </mesh>
      {/* Lightning bolt on wall */}
      <mesh position={[6.9, 2, 0]} rotation={[0, -Math.PI/2, 0]}>
        <planeGeometry args={[3, 2.5]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.8} />
      </mesh>
    </>
  )
}

function RestaurantInterior() {
  return (
    <>
      <Room w={16} depth={12} wallColor="#fef3c7" floorColor="#d97706" ceilColor="#fde68a" />
      <ambientLight intensity={0.85} />
      <pointLight position={[0, 3.5, 0]} intensity={0.8} color="#fde68a" distance={18} />
      {/* Dining tables */}
      {[-4,0,4].map((x,i)=>[-2.5,2.5].map((z,j)=>(
        <group key={`${i}${j}`} position={[x, 0, z]}>
          <Table pos={[0, 0.75, 0]} w={1.4} d={0.9} />
          <Chair pos={[-0.8, 0, 0]} rot={Math.PI/2} />
          <Chair pos={[ 0.8, 0, 0]} rot={-Math.PI/2} />
        </group>
      )))}
      {/* Kitchen window */}
      <mesh position={[0, 2, -5.9]}>
        <planeGeometry args={[5, 1.2]} />
        <meshBasicMaterial color="#7c4a1e" />
      </mesh>
      {/* Pendant lights */}
      {[-4,0,4].map((x,i)=>(
        <mesh key={i} position={[x, 2.8, 0]}>
          <sphereGeometry args={[0.18, 6, 5]} />
          <meshBasicMaterial color="#fef9c3" />
        </mesh>
      ))}
      {/* Menu board */}
      <mesh position={[-6.9, 2.2, -1]}>
        <planeGeometry args={[2.5, 1.8]} />
        <meshBasicMaterial color="#7c4a1e" />
      </mesh>
      {/* Outdoor awning visible */}
      <Box pos={[0, 3.45, 5.5]} w={16.5} h={0.12} d={1.8} color="#f97316" />
    </>
  )
}

function GasStationInterior() {
  return (
    <>
      <Room w={12} depth={10} wallColor="#f8fafc" floorColor="#e2e8f0" ceilColor="#f1f5f9" />
      <ambientLight intensity={1.0} />
      {/* Shelves with products */}
      <Shelf pos={[-4.5, 0, -2]} w={0.3} h={1.8} d={2.5} color="#334155" />
      <Shelf pos={[-4.5, 0,  1]} w={0.3} h={1.8} d={2.5} color="#334155" />
      {/* Counter */}
      <Counter pos={[2, 0, -3.5]} w={4} d={0.8} h={1.0} color="#374151" />
      <Box pos={[2, 1.0, -3.1]} w={4.4} h={0.08} d={0.35} color="#4b5563" />
      {/* Register */}
      <Box pos={[2, 1.1, -3.5]} w={0.7} h={0.45} d={0.4} color="#111827" />
      <mesh position={[2, 1.35, -3.25]}>
        <planeGeometry args={[0.55, 0.35]} />
        <meshBasicMaterial color="#1e3a5f" />
      </mesh>
      {/* Fridge */}
      <Box pos={[-5.5, 0.9, 1]} w={0.2} h={1.8} d={3} color="#1f2937" />
      <mesh position={[-5.3, 0.9, 1]}>
        <planeGeometry args={[2.8, 1.7]} />
        <meshBasicMaterial color="#bfdbfe" transparent opacity={0.6} />
      </mesh>
    </>
  )
}

function ChurchInterior() {
  return (
    <>
      <Room w={16} depth={14} wallColor="#f5f0e8" floorColor="#d4c4a8" ceilColor="#f8f5ee" />
      <ambientLight intensity={0.7} color="#fef9c3" />
      <directionalLight position={[0, 8, -5]} intensity={0.9} color="#fef9c3" />
      {/* Pews */}
      {[-1, 1].map((side,si)=>[-4,-1.5,1,3.5].map((z,i)=>(
        <Box key={`${si}${i}`} pos={[side*3, 0.3, z]} w={3.2} h={0.38} d={0.8} color="#92400e" />
      )))}
      {/* Altar */}
      <Box pos={[0, 0, -5.5]} w={4} h={0.4} d={2} color="#f8f5ee" />
      <Box pos={[0, 0.4, -5.5]} w={2} h={0.9} d={1.2} color="#e5e7eb" />
      {/* Cross */}
      <Box pos={[0, 2.8, -6.8]} w={0.15} h={1.2} d={0.15} color="#fbbf24" />
      <Box pos={[0, 3.1, -6.8]} w={0.65} h={0.15} d={0.15} color="#fbbf24" />
      {/* Stained glass windows */}
      {[-5.5, 5.5].map((x,i)=>(
        [-1, 1.5].map((z,j)=>(
          <mesh key={`${i}${j}`} position={[x, 2.2, z]}>
            <planeGeometry args={[0.8, 1.4]} />
            <meshBasicMaterial color={['#93c5fd','#fbbf24'][j]} transparent opacity={0.75} side={THREE.DoubleSide} />
          </mesh>
        ))
      ))}
      {/* Candles */}
      {[-1.5,0,1.5].map((x,i)=>(
        <mesh key={i} position={[x, 0.65, -5]}>
          <cylinderGeometry args={[0.04, 0.04, 0.35, 5]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
      ))}
    </>
  )
}

function PostOfficeInterior() {
  return (
    <>
      <Room w={14} depth={10} wallColor="#fef3c7" floorColor="#fde68a" ceilColor="#fef9c3" />
      <ambientLight intensity={0.9} />
      {/* Counter windows */}
      {[-3.5, 0, 3.5].map((x,i)=>(
        <group key={i} position={[x, 0, -3.5]}>
          <Counter pos={[0, 0, 0]} w={2.5} d={0.8} h={1.1} color="#fef3c7" />
          <mesh position={[0, 1.8, 0.2]}>
            <planeGeometry args={[2.0, 1.2]} />
            <meshBasicMaterial color="#bfdbfe" transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
      {/* Mailbox wall */}
      {[-4,-2,0,2,4].map(x=>[-1,0.5,2].map((y,j)=>(
        <Box key={`${x}${j}`} pos={[x, 1+j*0.55, -4.4]} w={0.75} h={0.45} d={0.12}
          color={j%2===0?'#1d4ed8':'#1e3a5f'} />
      )))}
      {/* Package sorting area */}
      <Box pos={[0, 0.35, 3]} w={5} h={0.35} d={2.5} color="#94a3b8" />
      {[[-1.5,0],[0,0],[1.5,0]].map(([x,z],i)=>(
        <Box key={i} pos={[x, 0.72, z+3]} w={0.8} h={0.55} d={0.7}
          color={['#ef4444','#3b82f6','#22c55e'][i]} />
      ))}
    </>
  )
}

function ApartmentsInterior() {
  return (
    <>
      <Room w={12} depth={10} wallColor="#334155" floorColor="#1e293b" ceilColor="#0f172a" />
      <ambientLight intensity={0.65} color="#fde68a" />
      <pointLight position={[0, 3.2, 0]} intensity={0.9} color="#fde68a" distance={16} />
      {/* Mailboxes */}
      {[-3,-1,1,3].map((x,i)=>[-0.2,0.6,1.4].map((y,j)=>(
        <Box key={`${i}${j}`} pos={[x, 1+y, -4.4]} w={1.2} h={0.55} d={0.14}
          color={j%2===0?'#334155':'#475569'} />
      )))}
      {/* Lobby sofa */}
      <Sofa pos={[0, 0, 2]} color="#475569" />
      {/* Plant */}
      <mesh position={[4.5, 0.55, 3.5]}>
        <cylinderGeometry args={[0.18, 0.22, 0.45, 7]} />
        <meshToonMaterial color="#374151" />
      </mesh>
      <mesh position={[4.5, 1.0, 3.5]}>
        <coneGeometry args={[0.38, 0.7, 7]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
      {/* Elevator doors */}
      <Box pos={[-5.5, 1.1, -3]} w={0.12} h={2.2} d={1.5} color="#475569" />
      <mesh position={[-5.35, 1.1, -3]}>
        <planeGeometry args={[1.4, 2.2]} />
        <meshBasicMaterial color="#1f2937" />
      </mesh>
      {/* Notice board */}
      <mesh position={[0, 2.2, -4.9]}>
        <planeGeometry args={[3, 1.5]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
      </mesh>
    </>
  )
}

function House1Interior() {
  return (
    <>
      <Room w={12} depth={10} wallColor="#bfdbfe" floorColor="#dbeafe" ceilColor="#eff6ff" />
      <ambientLight intensity={0.85} color="#fef9c3" />
      <pointLight position={[-3, 3.2, 1]} intensity={0.9} color="#fde68a" distance={14} />
      {/* Sofa + coffee table */}
      <Sofa pos={[-1, 0, 1]} color="#1d4ed8" />
      <Table pos={[-1, 0.45, -0.5]} w={1.2} d={0.6} h={0.45} color="#7c4a1e" />
      {/* TV */}
      <TVScreen pos={[-1, 1.2, -4.6]} w={1.8} h={1.0} />
      <Box pos={[-1, 0.25, -4.5]} w={2.2} h={0.25} d={0.45} color="#1f2937" />
      {/* Bookshelf */}
      <Shelf pos={[4.5, 0, 0]} w={0.3} h={2.2} d={3} color="#7c4a1e" />
      {/* Kitchen counter */}
      <Counter pos={[3, 0, -3.5]} w={3.5} d={0.7} h={0.9} color="#bfdbfe" />
      <Box pos={[3, 0.9, -3.2]} w={3.8} h={0.07} d={0.3} color="#93c5fd" />
      {/* Rug */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[-1, 0.01, 0.5]}>
        <planeGeometry args={[3, 2.2]} />
        <meshBasicMaterial color="#1d4ed8" transparent opacity={0.6} />
      </mesh>
      {/* Family photos */}
      {[-0.8, 0.4, 1.6].map((z,i)=>(
        <mesh key={i} position={[-5.8, 2.2+i*0.1, z]}>
          <planeGeometry args={[0.55, 0.45]} />
          <meshBasicMaterial color={['#bfdbfe','#fde68a','#bbf7d0'][i]} />
        </mesh>
      ))}
    </>
  )
}

function House2Interior() {
  return (
    <>
      <Room w={12} depth={10} wallColor="#fde68a" floorColor="#fef9c3" ceilColor="#fffbeb" />
      <ambientLight intensity={0.9} color="#fef9c3" />
      <pointLight position={[3, 3.2, 1]} intensity={0.9} color="#fde68a" distance={14} />
      {/* Sofa */}
      <Sofa pos={[1, 0, 1]} color="#b45309" />
      <Table pos={[1, 0.45, -0.4]} w={1.1} d={0.6} h={0.45} color="#92400e" />
      {/* TV */}
      <TVScreen pos={[1, 1.2, -4.6]} w={1.8} h={1.0} />
      <Box pos={[1, 0.25, -4.5]} w={2.2} h={0.25} d={0.45} color="#1f2937" />
      {/* Kitchen area */}
      <Counter pos={[-3, 0, -3.5]} w={3.5} d={0.7} h={0.9} color="#fde68a" />
      <Box pos={[-3, 0.9, -3.2]} w={3.8} h={0.07} d={0.3} color="#f59e0b" />
      {/* Dining table */}
      <Table pos={[-3, 0.75, 0.5]} w={1.8} d={1.0} color="#92400e" />
      {[-4,-3,-2].map((x,i)=><Chair key={i} pos={[x, 0, 0.5]} color="#b45309" />)}
      {/* Rug */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[1, 0.01, 0.5]}>
        <planeGeometry args={[3, 2.2]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.55} />
      </mesh>
      {/* Potted plants */}
      <mesh position={[4.8, 0.6, 4]}>
        <cylinderGeometry args={[0.2, 0.24, 0.5, 7]} />
        <meshToonMaterial color="#f59e0b" />
      </mesh>
      <mesh position={[4.8, 1.1, 4]}>
        <coneGeometry args={[0.4, 0.7, 7]} />
        <meshToonMaterial color="#16a34a" />
      </mesh>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERIOR DEFINITIONS  (bounds in half-widths for clamping)
// ═══════════════════════════════════════════════════════════════════════════
const INTERIOR_DEFS = {
  beach:       { name:'Beach Club',    hw:9.5, hd:7.5, component:BeachClubInterior,  interactables:[
    { id:'bartender', pos:[-3,0,-3.5], name:'Marco', emoji:'🍹', location:'Beach Club Bar',
      systemPrompt:'You are Marco, fun flirty bartender at the Beach Club. Speak casually, suggest cocktails and beach vibes. Keep replies 1-3 sentences.' },
    { id:'dj', pos:[4,0,-4.5], name:'DJ Sunny', emoji:'🎵', location:'Beach Club Stage',
      systemPrompt:'You are DJ Sunny. Talk music genres and vibes, ask what tracks the player wants. Keep replies 1-3 sentences.' },
  ]},
  cafe:        { name:'Café Aroma',    hw:6.5, hd:5.5, component:CafeInterior,       interactables:[
    { id:'barista', pos:[0,0,-3.5], name:'Priya the Barista', emoji:'☕', location:'Café Aroma',
      systemPrompt:'You are Priya, a cheerful barista at Café Aroma. Suggest coffee drinks, pastries, talk about your day. Keep replies 1-3 sentences.' },
  ]},
  arcade:      { name:'Pixel Arcade',  hw:8.5, hd:6.5, component:ArcadeInterior,     interactables:[
    { id:'host', pos:[0,0,4.5], name:'Game Host Leo', emoji:'🕹️', location:'Pixel Arcade',
      systemPrompt:'You are Leo, the energetic Pixel Arcade game host. Talk about high scores, recommend games, challenge the player. Keep replies 1-3 sentences.' },
    { id:'machine', pos:[3,0,-4], name:'Mystery Machine', emoji:'👾', location:'Pixel Arcade',
      systemPrompt:'You are a talking retro arcade machine with a snarky AI personality. Challenge the player to beat your scores. Keep replies 1-3 sentences.' },
  ]},
  rooftop:     { name:'Rooftop Lounge',hw:8.5, hd:6.5, component:RooftopInterior,    interactables:[
    { id:'bartender', pos:[0,0,-4], name:'Kai the Bartender', emoji:'🌙', location:'Rooftop Lounge',
      systemPrompt:'You are Kai, a cool rooftop bar bartender. Talk about cocktails, city views, and late-night vibes. Keep replies 1-3 sentences.' },
    { id:'guest', pos:[4,0,3], name:'Lounge Guest', emoji:'✨', location:'Rooftop Lounge',
      systemPrompt:'You are a stylish lounge guest at the rooftop bar. Chat about city life, fashion, and ambitions. Keep replies 1-3 sentences.' },
  ]},
  musicroom:   { name:'Music Studio',  hw:6.5, hd:5.5, component:MusicRoomInterior,  interactables:[
    { id:'producer', pos:[-1,0,1], name:'Producer Ravi', emoji:'🎛️', location:'Music Studio',
      systemPrompt:'You are Ravi, a music producer in the studio. Talk about beats, music production, upcoming tracks. Keep replies 1-3 sentences.' },
    { id:'mic', pos:[1,0,-1], name:'Studio Mic', emoji:'🎤', location:'Music Studio',
      systemPrompt:'You are a magical studio microphone that can channel songs. Tell the player about the last song recorded and ask what they want to record. Keep replies 1-3 sentences.' },
  ]},
  cityhall:    { name:'City Hall',     hw:10.5,hd:8.5, component:CityHallInterior,   interactables:[
    { id:'receptionist', pos:[0,0,2], name:'Receptionist Ms. Sharma', emoji:'🏛️', location:'City Hall',
      systemPrompt:'You are Ms. Sharma, a formal but helpful city hall receptionist. Talk about civic services, permits, and city news. Keep replies 1-3 sentences.' },
  ]},
  mall:        { name:'Grand Mall',    hw:10.5,hd:8.5, component:MallInterior,       interactables:[
    { id:'security', pos:[0,0,4.5], name:'Security Guard Sam', emoji:'🛍️', location:'Grand Mall',
      systemPrompt:'You are Sam, a friendly mall security guard. Talk about the mall shops, sales, and direct players around. Keep replies 1-3 sentences.' },
    { id:'shopkeeper', pos:[-6,0,-4], name:'Shop Owner Nisha', emoji:'🛒', location:'Grand Mall',
      systemPrompt:'You are Nisha, an enthusiastic mall shop owner. Talk about your latest items, deals, and fashion trends. Keep replies 1-3 sentences.' },
  ]},
  cinema:      { name:'Star Cinema',   hw:9.5, hd:8.5, component:CinemaInterior,     interactables:[
    { id:'vendor', pos:[-6,0,5.5], name:'Popcorn Vendor', emoji:'🎬', location:'Star Cinema',
      systemPrompt:'You are a happy popcorn vendor at Star Cinema. Talk about the movies showing, popcorn flavors, and cinema fun. Keep replies 1-3 sentences.' },
  ]},
  supermarket: { name:'FreshMart',     hw:9.5, hd:6.5, component:SupermarketInterior,interactables:[
    { id:'cashier', pos:[-3,0,4.5], name:'Cashier Arjun', emoji:'🛒', location:'FreshMart',
      systemPrompt:'You are Arjun, an upbeat FreshMart cashier. Talk about grocery deals, healthy food tips, and daily specials. Keep replies 1-3 sentences.' },
  ]},
  bank:        { name:'City Bank',     hw:7.5, hd:5.5, component:BankInterior,       interactables:[
    { id:'teller', pos:[0,0,-3], name:'Bank Teller Sana', emoji:'🏦', location:'City Bank',
      systemPrompt:'You are Sana, a professional and helpful bank teller. Talk about accounts, savings, and financial tips. Keep replies 1-3 sentences.' },
  ]},
  hospital:    { name:'City Hospital', hw:8.5, hd:6.5, component:HospitalInterior,   interactables:[
    { id:'doctor', pos:[0,0,0.5], name:'Dr. Mehta', emoji:'🏥', location:'City Hospital',
      systemPrompt:'You are Dr. Mehta, a warm and knowledgeable doctor. Give health tips and ask about symptoms, always suggesting proper care. Keep replies 1-3 sentences.' },
    { id:'nurse', pos:[-4,0,-3], name:'Nurse Priya', emoji:'💊', location:'City Hospital',
      systemPrompt:'You are Nurse Priya, caring and cheerful. Talk about patient care, health reminders, and wellness. Keep replies 1-3 sentences.' },
  ]},
  police:      { name:'Police HQ',     hw:6.5, hd:5.5, component:PoliceInterior,     interactables:[
    { id:'officer', pos:[0,0,0.5], name:'Officer Kabir', emoji:'👮', location:'Police HQ',
      systemPrompt:'You are Officer Kabir, firm but fair. Talk about city safety, laws, and community programs. Keep replies 1-3 sentences.' },
  ]},
  firestation: { name:'Fire Station',  hw:8.5, hd:6.5, component:FireStationInterior,interactables:[
    { id:'firefighter', pos:[0,0,3.5], name:'Firefighter Dev', emoji:'🚒', location:'Fire Station',
      systemPrompt:'You are Dev, an enthusiastic firefighter. Talk about fire safety, emergencies, and your team. Keep replies 1-3 sentences.' },
  ]},
  school:      { name:'City School',   hw:9.5, hd:6.5, component:SchoolInterior,     interactables:[
    { id:'teacher', pos:[0,0,-3.5], name:'Teacher Ms. Zoya', emoji:'🏫', location:'City School',
      systemPrompt:'You are Ms. Zoya, an inspiring and patient teacher. Ask the player what subject they want to learn, share fun facts. Keep replies 1-3 sentences.' },
  ]},
  library:     { name:'City Library',  hw:8.5, hd:6.5, component:LibraryInterior,    interactables:[
    { id:'librarian', pos:[0,0,-4.5], name:'Librarian Meera', emoji:'📚', location:'City Library',
      systemPrompt:'You are Meera, a wise and quiet librarian. Recommend books by genre, share literary quotes. Keep replies 1-3 sentences.' },
    { id:'reader', pos:[3,0,4.5], name:'Bookworm', emoji:'📖', location:'City Library',
      systemPrompt:'You are an enthusiastic bookworm reading in the library. Talk excitedly about the book you are reading and ask for recommendations. Keep replies 1-3 sentences.' },
  ]},
  gym:         { name:'Power Gym',     hw:7.5, hd:6.5, component:GymInterior,        interactables:[
    { id:'trainer', pos:{x:0,y:0,z:3}, name:'Trainer Vikram', emoji:'💪', location:'Power Gym',
      systemPrompt:'You are Vikram, an intense but supportive personal trainer. Give workout tips and motivational advice. Keep replies 1-3 sentences.' },
  ]},
  restaurant:  { name:'Spice Garden',  hw:7.5, hd:5.5, component:RestaurantInterior, interactables:[
    { id:'waiter', pos:[0,0,0], name:'Waiter Rohan', emoji:'🍕', location:'Spice Garden',
      systemPrompt:'You are Rohan, a charming restaurant waiter. Present menu items enthusiastically and ask about food preferences. Keep replies 1-3 sentences.' },
  ]},
  gasstation:  { name:'QuickFuel Shop',hw:5.5, hd:4.5, component:GasStationInterior, interactables:[
    { id:'cashier', pos:[2,0,-2.5], name:'Shop Cashier', emoji:'⛽', location:'QuickFuel Shop',
      systemPrompt:'You are the QuickFuel cashier. Talk about road trip snacks, fuel deals, and highway life. Keep replies 1-3 sentences.' },
  ]},
  church:      { name:'Sacred Temple', hw:7.5, hd:6.5, component:ChurchInterior,     interactables:[
    { id:'priest', pos:[0,0,-4.5], name:'Priest Father Anand', emoji:'⛪', location:'Sacred Temple',
      systemPrompt:'You are Father Anand, a calm and spiritual priest. Offer wisdom, blessings, and philosophical reflections. Keep replies 1-3 sentences.' },
  ]},
  postoffice:  { name:'Post Office',   hw:6.5, hd:4.5, component:PostOfficeInterior, interactables:[
    { id:'clerk', pos:[0,0,-2.5], name:'Postal Clerk', emoji:'📮', location:'Post Office',
      systemPrompt:'You are the friendly Post Office clerk. Help with mailing packages, stamps, and postal rates. Keep replies 1-3 sentences.' },
  ]},
  apartments:  { name:'City Apartments',hw:5.5,hd:4.5, component:ApartmentsInterior, interactables:[
    { id:'super', pos:[0,0,2], name:'Super Mr. Sharma', emoji:'🏢', location:'City Apartments',
      systemPrompt:'You are Mr. Sharma, the building superintendent. Talk about apartment living, maintenance, and building gossip. Keep replies 1-3 sentences.' },
  ]},
  house1:      { name:'Blue House',    hw:5.5, hd:4.5, component:House1Interior,     interactables:[
    { id:'resident', pos:[-1,0,0.5], name:'Anita', emoji:'🏠', location:'Blue House',
      systemPrompt:'You are Anita, a warm and welcoming homeowner. Talk about family life, home cooking, and neighborhood news. Keep replies 1-3 sentences.' },
    { id:'tv', pos:[-1,0,-3.5], name:'Smart TV', emoji:'📺', location:'Blue House',
      systemPrompt:'You are a Smart TV in the Blue House. Talk about shows, movies, and streaming recommendations. Keep replies 1-3 sentences.' },
  ]},
  house2:      { name:'Yellow House',  hw:5.5, hd:4.5, component:House2Interior,     interactables:[
    { id:'resident', pos:[1,0,0.5], name:'Suresh', emoji:'🏠', location:'Yellow House',
      systemPrompt:'You are Suresh, a cheerful homeowner who loves cooking. Talk about recipes, family dinners, and home improvements. Keep replies 1-3 sentences.' },
  ]},
}

// Fix trainer pos that was accidentally an object
if (INTERIOR_DEFS.gym.interactables[0].pos?.x !== undefined) {
  INTERIOR_DEFS.gym.interactables[0].pos = [0, 0, 3]
}

// ── Interior player controller ────────────────────────────────────────────
function InteriorController({ building, onExit, onInteract, avatar, onNearExit, onNearInteract }) {
  const { camera } = useThree()

  const charPos    = useRef(new THREE.Vector3(0, 0, building.hd - 1.5))
  const charFacing = useRef(Math.PI)
  const camYaw     = useRef(Math.PI)
  const camPitch   = useRef(0.45)
  const camDist    = useRef(9)
  const playerGroupRef = useRef()
  const keys       = useRef(new Set())
  const mouse      = useRef({ down: false, lastX: 0, lastY: 0 })
  const _move      = useRef(new THREE.Vector3())

  const isWalkingRef   = useRef(false)
  const [isWalking, setIsWalking] = useState(false)
  const nearExitRef    = useRef(false)
  const nearInteractRef = useRef(null)
  const [nearExit,     setNearExit]     = useState(false)
  const [nearInteract, setNearInteract] = useState(null)
  const detectTick     = useRef(0)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!gameControls.enabled) return
      if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) e.preventDefault()
      keys.current.add(e.code)

      if (e.code === 'KeyE' && nearExitRef.current) { onExit(); return }
      if (e.code === 'Escape') { onExit(); return }
      if (e.code === 'KeyF' && nearInteractRef.current) {
        onInteract(nearInteractRef.current)
      }
    }
    const onKeyUp = (e) => keys.current.delete(e.code)
    const onPointerDown = (e) => {
      if (e.button === 0) { mouse.current.down = true; mouse.current.lastX = e.clientX; mouse.current.lastY = e.clientY }
    }
    const onPointerMove = (e) => {
      if (!mouse.current.down) return
      const dx = e.clientX - mouse.current.lastX
      const dy = e.clientY - mouse.current.lastY
      mouse.current.lastX = e.clientX; mouse.current.lastY = e.clientY
      camYaw.current  -= dx * 0.005
      camPitch.current = THREE.MathUtils.clamp(camPitch.current + dy * 0.004, 0.1, 1.2)
    }
    const onPointerUp = (e) => { if (e.button === 0) mouse.current.down = false }
    const onWheel = (e) => { camDist.current = THREE.MathUtils.clamp(camDist.current + e.deltaY * 0.02, 2, 18) }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup',   onKeyUp)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup',   onPointerUp)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup',   onKeyUp)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup',   onPointerUp)
      window.removeEventListener('wheel', onWheel)
    }
  }, [])

  useFrame((_, delta) => {
    const SPEED = 5
    let moving = false
    _move.current.set(0, 0, 0)
    if (gameControls.enabled) {
      const sy = Math.sin(camYaw.current), cy = Math.cos(camYaw.current)
      if (keys.current.has('KeyW') || keys.current.has('ArrowUp'))    { _move.current.x -= sy; _move.current.z -= cy; moving = true }
      if (keys.current.has('KeyS') || keys.current.has('ArrowDown'))  { _move.current.x += sy; _move.current.z += cy; moving = true }
      if (keys.current.has('KeyA') || keys.current.has('ArrowLeft'))  { _move.current.x -= cy; _move.current.z += sy; moving = true }
      if (keys.current.has('KeyD') || keys.current.has('ArrowRight')) { _move.current.x += cy; _move.current.z -= sy; moving = true }
    }

    if (moving) {
      _move.current.normalize()
      charPos.current.addScaledVector(_move.current, SPEED * delta)
      charFacing.current = Math.atan2(_move.current.x, _move.current.z)
    }

    // Clamp to room bounds
    charPos.current.x = THREE.MathUtils.clamp(charPos.current.x, -building.hw + 0.6, building.hw - 0.6)
    charPos.current.z = THREE.MathUtils.clamp(charPos.current.z, -building.hd + 0.6, building.hd - 0.6)
    charPos.current.y = 0

    if (playerGroupRef.current) {
      playerGroupRef.current.position.set(charPos.current.x, 0, charPos.current.z)
      playerGroupRef.current.rotation.y = charFacing.current
    }

    const px = charPos.current.x, pz = charPos.current.z
    const d = camDist.current, p = camPitch.current, y = camYaw.current
    camera.position.set(px + d*Math.sin(y)*Math.cos(p), d*Math.sin(p), pz + d*Math.cos(y)*Math.cos(p))
    camera.lookAt(px, 0.9, pz)

    if (moving) audioSystem.playFootstep(false)
    if (moving !== isWalkingRef.current) { isWalkingRef.current = moving; setIsWalking(moving) }

    // Throttled proximity checks
    detectTick.current += delta
    if (detectTick.current > 0.12) {
      detectTick.current = 0
      const exitZ = building.hd - 1.5
      const ne = charPos.current.z > exitZ - 1.8 && Math.abs(charPos.current.x) < 2.5
      if (ne !== nearExitRef.current) { nearExitRef.current = ne; setNearExit(ne); onNearExit?.(ne) }

      let closest = null, closestDist = 2.6
      for (const obj of building.interactables) {
        const p2 = Array.isArray(obj.pos) ? obj.pos : [obj.pos.x, obj.pos.y, obj.pos.z]
        const dx = charPos.current.x - p2[0], dz = charPos.current.z - p2[2]
        const dist = Math.sqrt(dx*dx + dz*dz)
        if (dist < closestDist) { closestDist = dist; closest = obj }
      }
      if (closest?.id !== nearInteractRef.current?.id) { nearInteractRef.current = closest; setNearInteract(closest); onNearInteract?.(closest) }
    }
  })

  return (
    <>
      {/* Player avatar — same Mixamo model as the city world */}
      <group ref={playerGroupRef} position={[0, 0, building.hd - 1.5]}>
        <PlayerModel
          walking={isWalking}
          running={false}
          name=""
          outfit={avatar?.outfit || 'casual'}
          skin={avatar?.skin   || '#F4C08A'}
        />
      </group>

      {/* Exit door */}
      <ExitDoor hd={building.hd} isNear={nearExit} />

      {/* Interactable props */}
      {building.interactables.map(obj => {
        const p = Array.isArray(obj.pos) ? obj.pos : [obj.pos.x, obj.pos.y, obj.pos.z]
        return (
          <InteractableProp key={obj.id} pos={p} name={obj.name} emoji={obj.emoji}
            isNear={nearInteract?.id === obj.id} />
        )
      })}

      {/* Ambient for interiors that don't add their own */}
    </>
  )
}

// ── Overlay prompts (DOM, outside Canvas) ─────────────────────────────────
export function InteriorHUD({ nearExit, nearInteract, buildingName }) {
  return (
    <>
      {nearExit && (
        <div style={{
          position: 'absolute', bottom: '22%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#facc15', padding: '8px 22px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 15, pointerEvents: 'none',
          border: '1px solid #facc15', zIndex: 10,
        }}>Press <strong>E</strong> or <strong>Esc</strong> to exit {buildingName}</div>
      )}
      {nearInteract && (
        <div style={{
          position: 'absolute', bottom: '16%', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: '#a78bfa', padding: '7px 20px',
          borderRadius: 8, fontFamily: 'monospace', fontSize: 14, pointerEvents: 'none',
          border: '1px solid #7c3aed', zIndex: 10,
        }}>Press <strong>F</strong> to talk to {nearInteract.name}</div>
      )}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────
export default function InteriorScene({ buildingId, avatar, onExit, onInteract }) {
  useEffect(() => {
    audioSystem.setCrowdIndoor(true)
    return () => audioSystem.setCrowdIndoor(false)
  }, [])
  const building = INTERIOR_DEFS[buildingId]
  if (!building) return null
  const BldgComp = building.component
  const [nearExit,     setNearExit]     = useState(false)
  const [nearInteract, setNearInteract] = useState(null)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 8, 12], fov: 55, near: 0.1, far: 80 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <BldgComp />
        <Suspense fallback={null}>
          <InteriorController
            building={building} onExit={onExit} onInteract={onInteract} avatar={avatar}
            onNearExit={setNearExit} onNearInteract={setNearInteract}
          />
        </Suspense>
      </Canvas>
      <InteriorHUD nearExit={nearExit} nearInteract={nearInteract} buildingName={building.name} />
    </div>
  )
}

export { INTERIOR_DEFS }
