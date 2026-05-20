import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import WorldCanvas from '@/world/WorldCanvas'
import HUD from '@/components/HUD'
import ChatPanel from '@/components/ChatPanel'
import PlacePanel from '@/components/PlacePanel'

export default function Game() {
  const [activeNPC,   setActiveNPC]   = useState(null)
  const [activePlace, setActivePlace] = useState(null)

  function handleNPCChat(npc) {
    setActivePlace(null)
    setActiveNPC(npc)
  }

  function handlePlaceClick(place) {
    setActiveNPC(null)
    setActivePlace(place)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-night-950">
      {/* 3D World */}
      <WorldCanvas
        onPlaceClick={handlePlaceClick}
        onNPCChat={handleNPCChat}
      />

      {/* HUD overlay */}
      <HUD />

      {/* Panels */}
      <AnimatePresence>
        {activeNPC && (
          <ChatPanel
            key="chat"
            npc={activeNPC}
            onClose={() => setActiveNPC(null)}
          />
        )}
        {activePlace && !activeNPC && (
          <PlacePanel
            key="place"
            place={activePlace}
            onClose={() => setActivePlace(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
