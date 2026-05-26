import { useState, useEffect, useRef } from 'react'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { minimapState } from '@/lib/minimapState'

const ARROW_DIST = 60   // show edge arrow for players within this distance
const NEARBY_DIST = 60  // "players nearby" counter radius

// Returns { x, y } position of a directional arrow on the screen edge
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
  const tickRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      const myX    = minimapState.playerX
      const myZ    = minimapState.playerZ
      const camYaw = minimapState.camYaw  // camera facing direction

      const newArrows = []
      let nearby = 0

      remotePlayersRef.current.forEach((data, uid) => {
        const dx   = (data.x ?? 0) - myX
        const dz   = (data.z ?? 0) - myZ
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < NEARBY_DIST) nearby++

        if (dist > 2 && dist < ARROW_DIST) {
          // World angle from player to remote player
          const worldAngle = Math.atan2(dx, dz)
          // Screen angle = world angle - camera yaw
          const screenAngle = worldAngle - camYaw
          newArrows.push({
            uid,
            name:  data.name || 'Player',
            dist:  Math.round(dist),
            angle: screenAngle,
          })
        }
      })

      setArrows(newArrows)
      setNearbyCount(nearby)
    }, 200)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {/* Players nearby counter — top center */}
      {nearbyCount > 0 && (
        <div style={{
          position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 45, pointerEvents: 'none',
          background: 'rgba(0,0,0,0.65)',
          border: '1px solid rgba(0,229,255,0.5)',
          borderRadius: 20, padding: '4px 14px',
          color: '#00e5ff', fontSize: 13, fontWeight: 700,
          fontFamily: 'Nunito, sans-serif',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#00e5ff',
            boxShadow: '0 0 6px #00e5ff',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
          {nearbyCount} player{nearbyCount !== 1 ? 's' : ''} nearby
        </div>
      )}

      {/* Directional arrows at screen edges */}
      {arrows.map(({ uid, name, dist, angle }) => {
        const pos = edgeArrow(angle)
        return (
          <div
            key={uid}
            style={{
              position: 'fixed',
              left: pos.x,
              top:  pos.y,
              transform: 'translate(-50%, -50%)',
              zIndex: 44,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {/* Rotating arrow */}
            <div style={{
              fontSize: 18,
              transform: `rotate(${angle}rad)`,
              filter: 'drop-shadow(0 0 4px #00e5ff)',
              lineHeight: 1,
            }}>
              ▲
            </div>
            {/* Name + distance label */}
            <div style={{
              background: 'rgba(0,0,0,0.72)',
              border: '1px solid rgba(0,229,255,0.4)',
              borderRadius: 8,
              padding: '2px 7px',
              fontSize: 11,
              fontWeight: 700,
              color: '#00e5ff',
              fontFamily: 'Nunito, sans-serif',
              whiteSpace: 'nowrap',
            }}>
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
