import * as THREE from 'three'

// ── Car (front = +Z local, rear = -Z local) ───────────────────────────────
export function Car3D({ wheelRefs, dustRefs, bodyColor = '#e63946' }) {
  const body  = bodyColor
  const dark  = '#1a1a1a'
  const rim   = '#9ca3af'

  return (
    <group>
      {/* Lower body */}
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[1.85, 0.58, 3.8]} />
        <meshToonMaterial color={body} />
      </mesh>
      <mesh position={[0, 0.44, 0]} scale={[1.015, 1.04, 1.005]}>
        <boxGeometry args={[1.85, 0.58, 3.8]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>

      {/* Cabin */}
      <mesh position={[0, 1.02, 0.18]}>
        <boxGeometry args={[1.58, 0.68, 2.2]} />
        <meshToonMaterial color={body} />
      </mesh>
      <mesh position={[0, 1.02, 0.18]} scale={[1.02, 1.04, 1.01]}>
        <boxGeometry args={[1.58, 0.68, 2.2]} />
        <meshBasicMaterial color="#000" side={THREE.BackSide} />
      </mesh>

      {/* Windshields */}
      <mesh position={[0, 1.01, -0.9]} rotation={[0.5, 0, 0]}>
        <planeGeometry args={[1.42, 0.65]} />
        <meshBasicMaterial color="#87ceeb" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 1.01, 1.26]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[1.42, 0.65]} />
        <meshBasicMaterial color="#87ceeb" transparent opacity={0.75} side={THREE.DoubleSide} />
      </mesh>

      {/* Side windows */}
      {[-0.8, 0.8].map((x, i) => (
        <mesh key={i} position={[x, 1.02, 0.18]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.8, 0.58]} />
          <meshBasicMaterial color="#87ceeb" transparent opacity={0.65} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Wheels: FL, FR, RL, RR  (front=+Z, rear=-Z) */}
      {[
        [-0.97, 0.37,  1.18],
        [ 0.97, 0.37,  1.18],
        [-0.97, 0.37, -1.18],
        [ 0.97, 0.37, -1.18],
      ].map((pos, i) => (
        <group key={i} position={pos}>
          <mesh ref={el => { if (wheelRefs) wheelRefs.current[i] = el }} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.37, 0.37, 0.24, 12]} />
            <meshToonMaterial color={dark} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.19, 0.19, 0.26, 8]} />
            <meshToonMaterial color={rim} />
          </mesh>
        </group>
      ))}

      {/* Headlights — front face (+Z) */}
      {[[-0.58, 0.55], [0.58, 0.55]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 1.92]}>
          <sphereGeometry args={[0.13, 6, 4]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>
      ))}

      {/* Taillights — rear face (-Z) */}
      {[[-0.58, 0.52], [0.58, 0.52]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, -1.92]}>
          <sphereGeometry args={[0.11, 6, 4]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
      ))}

      {/* Bumpers */}
      <mesh position={[0, 0.35,  1.94]}><boxGeometry args={[1.65, 0.19, 0.12]} /><meshToonMaterial color={rim} /></mesh>
      <mesh position={[0, 0.35, -1.94]}><boxGeometry args={[1.65, 0.19, 0.12]} /><meshToonMaterial color={rim} /></mesh>

      {/* Dust puffs behind rear wheels — opacity driven by parent useFrame */}
      {[[-0.97, 0.06, -1.7], [0.97, 0.06, -1.7]].map((pos, i) => (
        <mesh key={i} ref={el => { if (dustRefs) dustRefs.current[i] = el }}
          position={pos} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.38, 7]} />
          <meshBasicMaterial color="#c4a35a" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ── Bike (front = +Z local, rear = -Z local) ──────────────────────────────
export function Bike3D({ wheelRefs, leanRef, dustRef, frameColor = '#7c3aed' }) {
  const frame = frameColor
  const dark  = '#1a1a1a'
  const rim   = '#9ca3af'

  return (
    <group>
      {/* Lean group — rotates on Z axis when banking into turns */}
      <group ref={leanRef}>
        {/* Rear wheel (-Z) */}
        <group position={[0, 0.38, -0.9]}>
          <mesh ref={el => { if (wheelRefs) wheelRefs.current[0] = el }} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.38, 0.38, 0.12, 12]} />
            <meshToonMaterial color={dark} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.13, 8]} />
            <meshToonMaterial color={rim} />
          </mesh>
        </group>

        {/* Front wheel (+Z) */}
        <group position={[0, 0.38, 0.9]}>
          <mesh ref={el => { if (wheelRefs) wheelRefs.current[1] = el }} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.38, 0.38, 0.12, 12]} />
            <meshToonMaterial color={dark} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.13, 8]} />
            <meshToonMaterial color={rim} />
          </mesh>
        </group>

        {/* Frame top tube */}
        <mesh position={[0, 0.78, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.052, 0.052, 1.75, 6]} />
          <meshToonMaterial color={frame} />
        </mesh>
        {/* Seat tube */}
        <mesh position={[0, 0.72, -0.22]} rotation={[0.22, 0, 0]}>
          <cylinderGeometry args={[0.048, 0.048, 0.82, 6]} />
          <meshToonMaterial color={frame} />
        </mesh>
        {/* Down tube */}
        <mesh position={[0, 0.66, 0.35]} rotation={[-0.5, 0, 0]}>
          <cylinderGeometry args={[0.044, 0.044, 1.02, 6]} />
          <meshToonMaterial color={frame} />
        </mesh>
        {/* Chain stay */}
        <mesh position={[0, 0.44, -0.6]} rotation={[0.14, 0, 0]}>
          <cylinderGeometry args={[0.038, 0.038, 0.72, 6]} />
          <meshToonMaterial color={frame} />
        </mesh>

        {/* Seat post */}
        <mesh position={[0, 0.96, -0.2]} rotation={[0.1, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 6]} />
          <meshToonMaterial color={rim} />
        </mesh>
        {/* Seat */}
        <mesh position={[0, 1.22, -0.22]}>
          <capsuleGeometry args={[0.085, 0.36, 4, 8]} />
          <meshToonMaterial color={dark} />
        </mesh>

        {/* Fork */}
        <mesh position={[0, 0.6, 0.74]} rotation={[-0.12, 0, 0]}>
          <cylinderGeometry args={[0.036, 0.036, 0.68, 6]} />
          <meshToonMaterial color={rim} />
        </mesh>
        {/* Stem */}
        <mesh position={[0, 1.1, 0.7]}>
          <cylinderGeometry args={[0.032, 0.032, 0.28, 6]} />
          <meshToonMaterial color={rim} />
        </mesh>
        {/* Handlebars */}
        <mesh position={[0, 1.22, 0.7]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.036, 0.036, 0.72, 6]} />
          <meshToonMaterial color={rim} />
        </mesh>
        {[-0.34, 0.34].map((x, i) => (
          <mesh key={i} position={[x, 1.22, 0.7]}>
            <sphereGeometry args={[0.068, 6, 4]} />
            <meshToonMaterial color={dark} />
          </mesh>
        ))}

        {/* Headlight */}
        <mesh position={[0, 1.08, 0.93]}>
          <sphereGeometry args={[0.07, 6, 4]} />
          <meshBasicMaterial color="#fffde7" />
        </mesh>

        {/* Dust puff behind rear wheel */}
        <mesh ref={dustRef} position={[0, 0.05, -1.35]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.28, 7]} />
          <meshBasicMaterial color="#c4a35a" transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
    </group>
  )
}
