// Personal house interior — level-scaled rooms, rest/sleep UI overlay.
import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { gameControls } from '@/lib/gameControls'
import { audioSystem } from '@/lib/audioSystem'
import { getHouseState, LEVEL_NAMES, canRest, canSleep, doRest, doSleep } from '@/lib/houseService'

// ── Primitive furniture helpers (reuse InteriorScene style) ───────────────────
function Box({ pos, w=1, h=1, d=1, color='#334155' }) {
  return (
    <group position={pos}>
      <mesh position={[0, h/2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshToonMaterial color={color} />
      </mesh>
    </group>
  )
}
function Sofa({ pos, rot=0, color='#7c3aed' }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <Box pos={[0, 0, 0]}    w={2.2} h={0.45} d={0.9}  color={color} />
      <Box pos={[0, 0, -0.4]} w={2.2} h={0.75} d={0.12} color={color} />
    </group>
  )
}
function Bed({ pos, rot=0, color='#3b82f6' }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      <Box pos={[0, 0, 0]}    w={1.6} h={0.35} d={2.2} color="#e2e8f0" />
      <Box pos={[0, 0.35, 0]} w={1.5} h={0.18} d={2.0} color={color} />
      <Box pos={[0, 0.35,-0.95]} w={1.4} h={0.22} d={0.3} color="#f8fafc" />
      <Box pos={[0, 0,-0.95]}    w={1.6} h={0.55} d={0.14} color="#d1d5db" />
    </group>
  )
}
function Table({ pos, w=1.2, d=0.7, color='#92400e' }) {
  return (
    <group position={pos}>
      <Box pos={[0, 0.75, 0]}  w={w}  h={0.07} d={d} color={color} />
      {[[-w/2+0.1,0,-d/2+0.1],[w/2-0.1,0,-d/2+0.1],[-w/2+0.1,0,d/2-0.1],[w/2-0.1,0,d/2-0.1]].map(([x,,z],i) => (
        <mesh key={i} position={[x, 0.37, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.74, 5]} />
          <meshToonMaterial color={color} />
        </mesh>
      ))}
    </group>
  )
}

// ── Room shell ────────────────────────────────────────────────────────────────
function Room({ w=10, depth=10, wallColor='#f1f5f9', floorColor='#c8956c' }) {
  const hw = w/2, hd = depth/2
  return (
    <>
      <pointLight position={[0, 3.4, 0]} intensity={1.2} color="#fffde7" distance={Math.max(w,depth)*2} />
      <ambientLight intensity={0.4} color="#ffffff" />
      {/* Floor */}
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <planeGeometry args={[w, depth]} />
        <meshToonMaterial color={floorColor} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI/2, 0, 0]} position={[0, 3.2, 0]}>
        <planeGeometry args={[w, depth]} />
        <meshToonMaterial color="#f8fafc" />
      </mesh>
      {/* Walls */}
      {[
        { pos:[0, 1.6,-hd], rot:[0,0,0] },
        { pos:[0, 1.6, hd], rot:[0,Math.PI,0] },
        { pos:[-hw, 1.6, 0], rot:[0,Math.PI/2,0] },
        { pos:[ hw, 1.6, 0], rot:[0,-Math.PI/2,0] },
      ].map(({pos,rot},i) => (
        <mesh key={i} position={pos} rotation={rot}>
          <planeGeometry args={[i<2?w:depth, 3.2]} />
          <meshToonMaterial color={wallColor} />
        </mesh>
      ))}
    </>
  )
}

// ── Level-scaled interior content ─────────────────────────────────────────────
function RoomContent({ level }) {
  const size  = [8, 9, 10, 12, 14, 16, 18][level - 1]
  const wc    = ['#f5e6d3','#e8f5e9','#e3f2fd','#fce4ec','#fff3e0','#ede7f6','#e0f7fa'][level - 1]
  const floor = ['#c8956c','#8d6e63','#78909c','#546e7a','#455a64','#37474f','#212121'][level - 1]

  return (
    <>
      <Room w={size} depth={size} wallColor={wc} floorColor={floor} />

      {/* Always: bed + sofa */}
      <Bed   pos={[size/2-2.5, 0, -size/2+2]} rot={Math.PI/2} color={['#3b82f6','#10b981','#8b5cf6','#ec4899','#f97316','#eab308','#06b6d4'][level-1]} />
      <Sofa  pos={[-size/2+2,  0,  size/2-2]} rot={-Math.PI/2+0.5} />
      <Table pos={[0, 0, 0]} w={1.4} d={0.8} />

      {/* Level 2+: wardrobe */}
      {level >= 2 && <Box pos={[size/2-0.5, 0, 0]} w={1} h={2.2} d={1.2} color="#7c4a1e" />}

      {/* Level 3+: bookshelf */}
      {level >= 3 && (
        <group position={[-size/2+0.5, 0, -1]}>
          <Box pos={[0, 0, 0]} w={0.35} h={2.5} d={2} color="#7c4a1e" />
        </group>
      )}

      {/* Level 4+: second sofa, coffee table */}
      {level >= 4 && <>
        <Sofa pos={[0, 0, size/2-2]} rot={Math.PI} />
        <Box  pos={[0, 0, size/2-4]} w={1.2} h={0.4} d={0.7} color="#92400e" />
      </>}

      {/* Level 5+: gaming desk */}
      {level >= 5 && (
        <group position={[size/2-2, 0, size/2-2]}>
          <Box pos={[0, 0, 0]} w={1.8} h={0.75} d={0.7} color="#1e293b" />
          <mesh position={[0, 1.0, -0.2]}>
            <planeGeometry args={[1.5, 0.9]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
        </group>
      )}

      {/* Level 6+: luxury decor pillars */}
      {level >= 6 && <>
        <Box pos={[-size/2+1, 0, size/2-1]} w={0.3} h={2.6} d={0.3} color="#fbbf24" />
        <Box pos={[ size/2-1, 0, size/2-1]} w={0.3} h={2.6} d={0.3} color="#fbbf24" />
      </>}

      {/* Level 7: helipad window */}
      {level >= 7 && (
        <mesh position={[0, 3.1, -size/2+0.1]} rotation={[Math.PI/2, 0, 0]}>
          <planeGeometry args={[4, 4]} />
          <meshBasicMaterial color="#0ea5e9" transparent opacity={0.4} />
        </mesh>
      )}
    </>
  )
}

// ── Simple first-person look controller (no movement inside house) ────────────
function InteriorLook() {
  const { camera } = useThree()
  const yaw   = useRef(0)
  const pitch = useRef(-0.1)

  useEffect(() => {
    camera.position.set(0, 1.5, 2)
    camera.fov = 60; camera.updateProjectionMatrix()
  }, [camera])

  useEffect(() => {
    const onMove = (e) => {
      if (!document.pointerLockElement) return
      yaw.current   -= e.movementX * 0.002
      pitch.current  = Math.max(-0.9, Math.min(0.6, pitch.current - e.movementY * 0.002))
    }
    document.addEventListener('mousemove', onMove)
    return () => document.removeEventListener('mousemove', onMove)
  }, [])

  useFrame(() => {
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ')
  })
  return null
}

// ── Overlay status widget ─────────────────────────────────────────────────────
function StatusBar({ resting, restSec, sleeping, sleepSec }) {
  if (!resting && !sleeping) return null
  const label  = sleeping ? '🌙 Sleeping…' : '😌 Resting…'
  const secs   = sleeping ? sleepSec : restSec
  const color  = sleeping ? '#8b5cf6' : '#6366f1'
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[800] text-center pointer-events-none font-body">
      <div className="rounded-2xl text-white font-extrabold text-xl"
        style={{ background:`${color}cc`, padding:'18px 36px', boxShadow:`0 0 40px ${color}66` }}>
        {label}
        <div className="text-[14px] font-normal mt-1 opacity-80">{secs}s remaining</div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function HouseInterior({ onExit, initialAction = null }) {
  const hs = getHouseState()
  const { level, levelName } = hs

  const [resting,   setResting]   = useState(false)
  const [restSec,   setRestSec]   = useState(30)
  const [sleeping,  setSleeping]  = useState(false)
  const [sleepSec,  setSleepSec]  = useState(60)
  const [dimmed,    setDimmed]    = useState(false)
  const [fadeIn,    setFadeIn]    = useState(true)
  const [morning,   setMorning]   = useState(null)
  const [locked,    setLocked]    = useState(false)

  // Fade in on mount
  useEffect(() => {
    setTimeout(() => setFadeIn(false), 600)
    // Auto-start action if passed in
    if (initialAction === 'rest')  startRest()
    if (initialAction === 'sleep') startSleep()
  }, [])

  // Key handler: Escape = exit, E = interact
  useEffect(() => {
    const onKey = (e) => {
      if (locked) return
      if (e.code === 'Escape' || e.code === 'KeyQ') onExit?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit, locked])

  function startRest() {
    if (!canRest() || resting || sleeping) return
    setResting(true); setRestSec(30); setLocked(true)
    const iv = setInterval(() => {
      setRestSec(s => {
        if (s <= 1) {
          clearInterval(iv)
          setResting(false); setLocked(false)
          doRest()
          window.dispatchEvent(new CustomEvent('stats-boost', { detail: { amount: 20 } }))
          return 30
        }
        return s - 1
      })
    }, 1000)
  }

  function startSleep() {
    if (!canSleep() || resting || sleeping) return
    setSleeping(true); setSleepSec(60); setLocked(true)
    setDimmed(true)
    const now = new Date()
    setMorning(`Good morning! It's ${now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`)
    const iv = setInterval(() => {
      setSleepSec(s => {
        if (s <= 1) {
          clearInterval(iv)
          setSleeping(false); setLocked(false); setDimmed(false)
          doSleep()
          window.dispatchEvent(new CustomEvent('stats-boost', { detail: { amount: 100, full: true } }))
          return 60
        }
        return s - 1
      })
    }, 1000)
  }

  return (
    <div className="fixed inset-0 z-[400]">
      {/* Fade in overlay */}
      {fadeIn && (
        <div className="fixed inset-0 z-[900] bg-black pointer-events-none"
          style={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.6s' }} />
      )}

      {/* Sleep dim */}
      {dimmed && (
        <div className="fixed inset-0 z-[600] bg-black pointer-events-none"
          style={{ opacity: 0.7 }}>
          {/* Star particles */}
          {[...Array(20)].map((_,i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{
                width: 2, height: 2,
                left: `${5 + i*4.5}%`, top: `${10 + (i%5)*15}%`,
                opacity: 0.4 + Math.sin(i)*0.4,
                animation: `pulse ${1+i*0.1}s infinite`,
              }} />
          ))}
        </div>
      )}

      {/* Morning message */}
      {morning && !sleeping && (
        <div className="fixed top-[30%] left-1/2 -translate-x-1/2 z-[700] text-center font-body">
          <div className="text-yellow-300 font-extrabold text-2xl" style={{ textShadow:'0 0 20px #fbbf24' }}>
            ☀️ {morning}
          </div>
        </div>
      )}

      {/* Status overlay */}
      <StatusBar resting={resting} restSec={restSec} sleeping={sleeping} sleepSec={sleepSec} />

      {/* 3D scene */}
      <Canvas
        camera={{ position: [0, 1.5, 2], fov: 60, near: 0.1, far: 200 }}
        gl={{ antialias: true }}
        onClick={e => e.currentTarget.requestPointerLock?.()}
      >
        <InteriorLook />
        <RoomContent level={level} />
      </Canvas>

      {/* HUD bar at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-[500] flex items-center justify-between px-5 py-3 font-body"
        style={{ background:'rgba(8,4,20,0.9)', borderTop:'1px solid rgba(124,58,237,0.3)' }}>
        <div>
          <div className="text-violet-400 font-bold text-[13px]">🏠 {levelName}</div>
          <div className="text-slate-500 text-[10px]">Click canvas to look around · Q/Esc to exit</div>
        </div>
        <div className="flex gap-2">
          <button onClick={startRest}
            disabled={resting || sleeping || !canRest()}
            className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
            style={{ background:'rgba(99,102,241,0.6)', color:'#fff', padding:'6px 14px' }}>
            😌 Rest
          </button>
          <button onClick={startSleep}
            disabled={resting || sleeping || !canSleep()}
            className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
            style={{ background:'rgba(139,92,246,0.6)', color:'#fff', padding:'6px 14px' }}>
            🌙 Sleep
          </button>
          <button onClick={() => !locked && onExit?.()}
            disabled={locked}
            className="border-0 rounded-lg text-[12px] font-bold cursor-pointer font-body disabled:opacity-35"
            style={{ background:'rgba(255,255,255,0.1)', color:'#94a3b8', padding:'6px 14px' }}>
            Exit ↩
          </button>
        </div>
      </div>
    </div>
  )
}
