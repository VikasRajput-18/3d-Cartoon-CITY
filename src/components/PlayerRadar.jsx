import { useState, useEffect } from 'react'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { minimapState } from '@/lib/minimapState'

const ARROW_DIST  = 60
const NEARBY_DIST = 60

function edgeArrow(angleRad, margin = 56) {
  const W = window.innerWidth, H = window.innerHeight
  const cx = W / 2, cy = H / 2
  const cos = Math.cos(angleRad), sin = Math.sin(angleRad)
  const scaleX = (cx - margin) / Math.abs(sin || 0.001)
  const scaleY = (cy - margin) / Math.abs(cos || 0.001)
  const scale  = Math.min(scaleX, scaleY)
  return { x: cx + sin * scale, y: cy - cos * scale, angle: angleRad }
}

export default function PlayerRadar() {
  const [arrows,      setArrows]      = useState([])
  const [nearbyCount, setNearbyCount] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      const myX    = minimapState.playerX
      const myZ    = minimapState.playerZ
      const camYaw = minimapState.camYaw

      const newArrows = []
      let nearby = 0

      remotePlayersRef.current.forEach((data, uid) => {
        const dx   = (data.x ?? 0) - myX
        const dz   = (data.z ?? 0) - myZ
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < NEARBY_DIST) nearby++
        if (dist > 2 && dist < ARROW_DIST) {
          const worldAngle  = Math.atan2(dx, dz)
          const screenAngle = worldAngle - camYaw
          newArrows.push({ uid, name: data.name || 'Player', dist: Math.round(dist), angle: screenAngle })
        }
      })

      setArrows(newArrows)
      setNearbyCount(nearby)
    }, 200)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {nearbyCount > 0 && (
        <div
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[45] pointer-events-none flex items-center gap-[6px] font-bold font-body"
          style={{
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(0,229,255,0.5)',
            borderRadius: 20, padding: '4px 14px',
            color: '#00e5ff', fontSize: 13,
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: '#00e5ff', boxShadow: '0 0 6px #00e5ff', animation: 'pulse 1.5s ease-in-out infinite' }}
          />
          {nearbyCount} player{nearbyCount !== 1 ? 's' : ''} nearby
        </div>
      )}

      {arrows.map(({ uid, name, dist, angle }) => {
        const pos = edgeArrow(angle)
        return (
          <div
            key={uid}
            className="fixed pointer-events-none flex flex-col items-center gap-0.5"
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', zIndex: 44 }}
          >
            <div style={{ fontSize: 18, transform: `rotate(${angle}rad)`, filter: 'drop-shadow(0 0 4px #00e5ff)', lineHeight: 1 }}>
              ▲
            </div>
            <div
              className="whitespace-nowrap font-bold font-body"
              style={{
                background: 'rgba(0,0,0,0.72)',
                border: '1px solid rgba(0,229,255,0.4)',
                borderRadius: 8, padding: '2px 7px',
                fontSize: 11, color: '#00e5ff',
              }}
            >
              {name} · {dist}m
            </div>
          </div>
        )
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.35); }
        }
      `}</style>
    </>
  )
}
