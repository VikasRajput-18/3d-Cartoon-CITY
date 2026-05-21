import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useStore } from '@/store'
import WorldCanvas from '@/world/WorldCanvas'
import InteriorScene, { INTERIOR_DEFS } from '@/world/InteriorScene'
import HUD from '@/components/HUD'
import ChatPanel from '@/components/ChatPanel'
import AIChat from '@/components/AIChat'

export default function Game() {
  const avatar = useStore(s => s.avatar)

  // City NPC chat (wandering NPCs)
  const [activeNPC, setActiveNPC] = useState(null)

  // Interior mode
  const [mode,           setMode]           = useState('city')      // 'city' | 'interior'
  const [activeBuilding, setActiveBuilding] = useState(null)        // building id string
  const [fading,         setFading]         = useState(false)
  const [chatNpc,        setChatNpc]        = useState(null)        // interior NPC object

  function enterBuilding(id) {
    if (!INTERIOR_DEFS[id]) return
    setFading(true)
    setTimeout(() => {
      setMode('interior')
      setActiveBuilding(id)
      // Double-rAF so the new scene renders before fade-in starts
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)))
    }, 350)
  }

  function exitBuilding() {
    setChatNpc(null)
    setFading(true)
    setTimeout(() => {
      setMode('city')
      setActiveBuilding(null)
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)))
    }, 350)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-night-950">

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

      {/* HUD overlay (minimap etc.) */}
      <HUD />

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
