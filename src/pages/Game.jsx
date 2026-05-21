import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '@/store'
import WorldCanvas from '@/world/WorldCanvas'
import InteriorScene, { INTERIOR_DEFS } from '@/world/InteriorScene'
import HUD from '@/components/HUD'
import ChatPanel from '@/components/ChatPanel'
import AIChat from '@/components/AIChat'
import Minimap from '@/components/Minimap'
import TimeWeatherHUD from '@/components/TimeWeatherHUD'
import MobileControls from '@/components/MobileControls'
import VolumeControl from '@/components/VolumeControl'
import { useMobile } from '@/lib/useMobile'
import { audioSystem } from '@/lib/audioSystem'

export default function Game() {
  const avatar    = useStore(s => s.avatar)
  const isMobile  = useMobile()

  // City NPC chat (wandering NPCs)
  const [activeNPC, setActiveNPC] = useState(null)

  // Interior mode
  const [mode,           setMode]           = useState('city')      // 'city' | 'interior'
  const [activeBuilding, setActiveBuilding] = useState(null)        // building id string
  const [fading,         setFading]         = useState(false)
  const [chatNpc,        setChatNpc]        = useState(null)        // interior NPC object

  function enterBuilding(id) {
    if (!INTERIOR_DEFS[id]) return
    audioSystem.playTransition()
    audioSystem.startIndoor()
    setFading(true)
    setTimeout(() => {
      setMode('interior')
      setActiveBuilding(id)
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)))
    }, 350)
  }

  function exitBuilding() {
    setChatNpc(null)
    audioSystem.playTransition()
    audioSystem.stopIndoor()
    setFading(true)
    setTimeout(() => {
      setMode('city')
      setActiveBuilding(null)
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)))
    }, 350)
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-night-950"
      onPointerDown={() => audioSystem.unlock()}
    >

      {/* 3D World */}
      {mode === 'city' && (
        <WorldCanvas
          onNPCChat={npc => { setActiveNPC(npc) }}
          onEnterBuilding={enterBuilding}
        />
      )}

      {/* Interior */}
      {mode === 'interior' && activeBuilding && (
        <InteriorScene
          buildingId={activeBuilding}
          avatar={avatar}
          onExit={exitBuilding}
          onInteract={setChatNpc}
        />
      )}

      {/* HUD overlay */}
      <HUD />

      {/* Volume control — always visible */}
      <VolumeControl />

      {/* Time + weather indicator */}
      <TimeWeatherHUD />

      {/* Minimap — city mode only */}
      {mode === 'city' && <Minimap isMobile={isMobile} />}

      {/* City wandering NPC chat */}
      <AnimatePresence>
        {mode === 'city' && activeNPC && (
          <ChatPanel
            key="chat"
            npc={activeNPC}
            onClose={() => setActiveNPC(null)}
          />
        )}
      </AnimatePresence>

      {/* Interior AI chat */}
      <AnimatePresence>
        {chatNpc && (
          <AIChat
            key="aichat"
            npc={chatNpc}
            onClose={() => setChatNpc(null)}
          />
        )}
      </AnimatePresence>

      {/* Mobile touch controls — joystick + action buttons */}
      {isMobile && mode === 'city' && <MobileControls />}

      {/* Fade overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: '#000',
        opacity: fading ? 1 : 0,
        transition: 'opacity 0.35s',
        pointerEvents: fading ? 'all' : 'none',
        zIndex: 1000,
      }} />
    </div>
  )
}
