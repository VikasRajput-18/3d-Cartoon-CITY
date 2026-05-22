import { useState, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useUser } from '@clerk/clerk-react'
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
import CrowdControl from '@/components/CrowdControl'
import ProfilePanel from '@/components/ProfilePanel'
import GlobalChat from '@/components/GlobalChat'
import OnlinePlayersHUD from '@/components/OnlinePlayersHUD'
import DirectChat from '@/components/DirectChat'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { chatState } from '@/lib/minimapState'
import GameMenu from '@/games/GameMenu'
import GameRunner from '@/games/GameRunner'
import { LOCATION_GAMES } from '@/games/index'
import { useMobile } from '@/lib/useMobile'
import { audioSystem } from '@/lib/audioSystem'

export default function Game() {
  const avatar = useStore(s => s.avatar)
  const isMobile = useMobile()
  const { user } = useUser()

  // Multiplayer — remote players, presence, chat
  const { remotePlayerIds, onlinePlayers, globalMessages, sendGlobalMessage } =
    useMultiplayer({ userId: user?.id, avatar })

  // City NPC chat (wandering NPCs)
  const [activeNPC, setActiveNPC] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [directChatTarget, setDirectChatTarget] = useState(null)  // { uid, name }

  // Sync active NPC name to module-level chatState so NPC component can read it each frame
  useEffect(() => { chatState.activeNpcName = activeNPC?.name ?? null }, [activeNPC])

  // Auto-close NPC chat when player walks away (dispatched by NPC component in WorldCanvas)
  useEffect(() => {
    const handler = () => setActiveNPC(null)
    window.addEventListener('npc-auto-close', handler)
    return () => window.removeEventListener('npc-auto-close', handler)
  }, [])

  // Interior mode
  const [mode, setMode] = useState('city')      // 'city' | 'interior'
  const [activeBuilding, setActiveBuilding] = useState(null)        // building id string
  const [fading, setFading] = useState(false)
  const [chatNpc, setChatNpc] = useState(null)        // interior NPC object

  // Mini-games
  const [showGameMenu, setShowGameMenu] = useState(false)
  const [activeGame, setActiveGame] = useState(null)            // game id string | null
  const buildingGames = activeBuilding ? (LOCATION_GAMES[activeBuilding] || []) : []

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
    setShowGameMenu(false)
    setActiveGame(null)
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
          remotePlayerIds={remotePlayerIds}
          onPlayerClick={(uid, name) => setDirectChatTarget({ uid, name })}
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
      <CrowdControl />

      {/* Online players indicator */}
      <OnlinePlayersHUD onlinePlayers={onlinePlayers} />

      {/* Profile button */}
      <button
        onClick={() => setShowProfile(true)}
        title={avatar.name}
        style={{
          position: 'fixed', top: 96, right: 12, zIndex: 40,
          width: 34, height: 34, borderRadius: '50%',
          background: user?.imageUrl ? 'transparent' : 'rgba(124,58,237,0.8)',
          border: '1.5px solid rgba(124,58,237,0.5)',
          cursor: 'pointer', padding: 0, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{avatar.name?.[0]?.toUpperCase() || '?'}</span>
        }
      </button>

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

      {/* Play Game button — shown in interior mode when games are available */}
      {mode === 'interior' && buildingGames.length > 0 && !chatNpc && !activeGame && (
        <button
          onClick={() => { audioSystem.playClick(); setShowGameMenu(true) }}
          style={{
            position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
            border: 'none', borderRadius: 12, padding: '10px 28px',
            color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            fontFamily: 'Nunito, sans-serif', zIndex: 50, boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
          }}
        >
          🎮 Play a Game
        </button>
      )}

      {/* Game menu overlay */}
      <AnimatePresence>
        {showGameMenu && (
          <GameMenu
            key="gamemenu"
            games={buildingGames}
            buildingName={INTERIOR_DEFS[activeBuilding]?.name ?? ''}
            onSelect={id => { setShowGameMenu(false); setActiveGame(id) }}
            onClose={() => setShowGameMenu(false)}
          />
        )}
      </AnimatePresence>

      {/* Active mini-game fullscreen */}
      {activeGame && (
        <GameRunner
          gameId={activeGame}
          onClose={() => setActiveGame(null)}
        />
      )}

      {/* Profile panel */}
      <AnimatePresence>
        {showProfile && (
          <ProfilePanel key="profile" onClose={() => setShowProfile(false)} />
        )}
      </AnimatePresence>

      {/* Global / nearby multiplayer chat */}
      {mode === 'city' && (
        <GlobalChat
          globalMessages={globalMessages}
          onSendGlobal={sendGlobalMessage}
          onlineCount={onlinePlayers.length}
        />
      )}

      {/* Direct message panel — opens when clicking another real player */}
      {directChatTarget && (
        <DirectChat
          myId={user?.id}
          myName={avatar.name}
          targetId={directChatTarget.uid}
          targetName={directChatTarget.name}
          onClose={() => setDirectChatTarget(null)}
        />
      )}

      {/* Mobile touch controls — always visible on mobile except inside mini-games */}
      {isMobile && !activeGame && <MobileControls />}

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
