import { useState, useEffect, useCallback, useRef } from 'react'
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
import AudioPanel from '@/components/AudioPanel'
import ProfilePanel from '@/components/ProfilePanel'
import GlobalChat from '@/components/GlobalChat'
import OnlinePlayersHUD from '@/components/OnlinePlayersHUD'
import DirectChat from '@/components/DirectChat'
import MsgToast, { toastStyle } from '@/components/MsgToast'
import { useMultiplayer } from '@/hooks/useMultiplayer'
import { useVoiceChat } from '@/hooks/useVoiceChat'
import { chatState, minimapState } from '@/lib/minimapState'
import { onChatNotification } from '@/lib/chatNotifications'
import { audioSystem } from '@/lib/audioSystem'
import GameMenu from '@/games/GameMenu'
import GameRunner from '@/games/GameRunner'
import { LOCATION_GAMES } from '@/games/index'
import { useMobile } from '@/lib/useMobile'
import MissionPanel from '@/components/MissionPanel'
import BossHealthBar from '@/components/BossHealthBar'
import { initMissions, recordNPCTalk, completeMission, completeDailyMission } from '@/lib/missionState'
import { initBoss, attackBoss, spawnBoss } from '@/lib/bossState'
import { initEconomy, addCoins, addGems, onEconomyUpdate, getEconomyState, startPassiveIncome, stopPassiveIncome } from '@/lib/economyState'
import FastTravel from '@/components/FastTravel'

export default function Game() {
  const avatar   = useStore(s => s.avatar)
  const isMobile = useMobile()
  const { user } = useUser()

  // Multiplayer
  const { remotePlayerIds, onlinePlayers, globalMessages, sendGlobalMessage } =
    useMultiplayer({ userId: user?.id, avatar })

  // Voice chat
  const voice = useVoiceChat({ userId: user?.id, onlinePlayers })

  // Mission + boss system
  const [showMissions,    setShowMissions]    = useState(false)
  const [bossBanner,      setBossBanner]      = useState(null)   // null | 'spawned' | 'defeated'
  const [showFastTravel,  setShowFastTravel]  = useState(false)
  const [dailyBonus,      setDailyBonus]      = useState(null)   // null | { coins, tickets, streak, streakBonus }

  // NPC chat
  const [activeNPC,         setActiveNPC]         = useState(null)
  const [showProfile,       setShowProfile]       = useState(false)
  const [directChatTarget,  setDirectChatTarget]  = useState(null)

  // Right-click context menu
  const [playerCtxMenu, setPlayerCtxMenu] = useState(null)
  const ctxMenuRef = useRef()

  const handlePlayerContextMenu = useCallback((uid, name, x, y) => {
    setPlayerCtxMenu({ uid, name, x, y })
  }, [])

  useEffect(() => {
    if (!playerCtxMenu) return
    const handler = (e) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target)) setPlayerCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [playerCtxMenu])

  useEffect(() => { chatState.activeNpcName = activeNPC?.name ?? null }, [activeNPC])

  // Record NPC talk for missions/daily
  useEffect(() => {
    if (activeNPC?.name) recordNPCTalk(activeNPC.name)
  }, [activeNPC?.name])

  // Sync store wallet from economyState
  const setWallet        = useStore(s => s.setWallet)
  const setOwnedOutfits  = useStore(s => s.setOwnedOutfits)
  const setLoginStreak   = useStore(s => s.setLoginStreak)

  useEffect(() => onEconomyUpdate((eco) => {
    setWallet({ coins: eco.coins, gems: eco.gems, tickets: eco.tickets })
    setOwnedOutfits(eco.ownedOutfits)
    setLoginStreak(eco.loginStreak)
  }), [])

  // Init economy + missions + boss once user is ready
  useEffect(() => {
    if (!user?.id) return
    initEconomy(user.id).then(bonus => {
      if (bonus?.given) setDailyBonus(bonus)
    })
    initMissions(user.id, avatar.name)
    initBoss()
    startPassiveIncome()
    return () => stopPassiveIncome()
  }, [user?.id])

  // Economy reward listener (missions, boss, daily)
  useEffect(() => {
    const handler = ({ detail }) => {
      if (detail?.coins) addCoins(detail.coins)
      if (detail?.gems)  addGems(detail.gems)
    }
    window.addEventListener('economy-reward', handler)
    return () => window.removeEventListener('economy-reward', handler)
  }, [])

  // Mission + boss event bus
  useEffect(() => {
    const onMissionUnlocked = ({ detail }) => {
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), {
        id, type: 'global',
        fromName: '🗺️ Mission', text: `New mission: ${detail.title}`,
        onClick: () => setShowMissions(true),
      }])
    }
    const onBossSpawned = () => {
      setBossBanner('spawned')
      setTimeout(() => setBossBanner(null), 8000)
    }
    const onBossDefeated = () => {
      setBossBanner('defeated')
      setTimeout(() => setBossBanner(null), 8000)
    }
    const onBossActivate = () => {
      spawnBoss()
    }
    const onPlayerInteract = ({ detail }) => {
      if (detail?.nearBoss) { attackBoss(user?.id); window.dispatchEvent(new CustomEvent('boss-hit')) }
      if (detail?.nearOrb)  { completeMission('m1_3'); window.dispatchEvent(new CustomEvent('orb-collected')) }
    }
    window.addEventListener('mission-unlocked',  onMissionUnlocked)
    window.addEventListener('boss-spawned',      onBossSpawned)
    window.addEventListener('boss-defeated',     onBossDefeated)
    window.addEventListener('boss-activate',     onBossActivate)
    window.addEventListener('player-interact',   onPlayerInteract)
    return () => {
      window.removeEventListener('mission-unlocked',  onMissionUnlocked)
      window.removeEventListener('boss-spawned',      onBossSpawned)
      window.removeEventListener('boss-defeated',     onBossDefeated)
      window.removeEventListener('boss-activate',     onBossActivate)
      window.removeEventListener('player-interact',   onPlayerInteract)
    }
  }, [user?.id])

  // Daily mission: vehicle driving time (30 s)
  useEffect(() => {
    let elapsed = 0
    const id = setInterval(() => {
      if (minimapState.drivingType) {
        elapsed += 0.5
        if (elapsed >= 30) { completeDailyMission('daily_vehicle'); clearInterval(id) }
      }
    }, 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = () => setActiveNPC(null)
    window.addEventListener('npc-auto-close', handler)
    return () => window.removeEventListener('npc-auto-close', handler)
  }, [])

  // Interior mode
  const [mode,           setMode]           = useState('city')
  const [activeBuilding, setActiveBuilding] = useState(null)
  const [fading,         setFading]         = useState(false)
  const [chatNpc,        setChatNpc]        = useState(null)

  // Mini-games
  const [showGameMenu, setShowGameMenu] = useState(false)
  const [activeGame,   setActiveGame]   = useState(null)
  const buildingGames = activeBuilding ? (LOCATION_GAMES[activeBuilding] || []) : []

  function enterBuilding(id) {
    if (!INTERIOR_DEFS[id]) return
    completeDailyMission('daily_building')
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

  // ── Notifications ─────────────────────────────────────────────────────────
  const [globalChatOpen, setGlobalChatOpen] = useState(false)
  const [unreadGlobal,   setUnreadGlobal]   = useState(0)
  const [dmUnread,       setDmUnread]       = useState({})  // uid → count
  const [msgToasts,      setMsgToasts]      = useState([])
  const toastIdRef = useRef(0)

  // Refs so the notification callback never goes stale
  const globalChatOpenRef    = useRef(false)
  const directChatTargetRef  = useRef(null)
  useEffect(() => { globalChatOpenRef.current   = globalChatOpen }, [globalChatOpen])
  useEffect(() => { directChatTargetRef.current = directChatTarget }, [directChatTarget])

  const dismissToast = useCallback((id) => {
    setMsgToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    return onChatNotification((type, payload) => {
      if (type === 'global') {
        if (!globalChatOpenRef.current) setUnreadGlobal(n => n + 1)
        audioSystem.playChime()
        const id = ++toastIdRef.current
        setMsgToasts(prev => [...prev.slice(-2), {
          id, type: 'global',
          fromId: payload.fromId, fromName: payload.fromName, text: payload.text,
          onClick: () => setGlobalChatOpen(true),
        }])
      } else if (type === 'dm') {
        const isOpen = directChatTargetRef.current?.uid === payload.fromId
        if (!isOpen) {
          setDmUnread(prev => ({ ...prev, [payload.fromId]: (prev[payload.fromId] || 0) + 1 }))
          audioSystem.playChime()
          const id = ++toastIdRef.current
          setMsgToasts(prev => [...prev.slice(-2), {
            id, type: 'dm',
            fromId: payload.fromId, fromName: payload.fromName, text: payload.text,
            onClick: () => setDirectChatTarget({ uid: payload.fromId, name: payload.fromName }),
          }])
        }
      }
    })
  }, []) // stable — reads state via refs

  // Reset unread on open
  useEffect(() => { if (globalChatOpen) setUnreadGlobal(0) }, [globalChatOpen])
  useEffect(() => {
    if (directChatTarget?.uid) {
      setDmUnread(prev => { const n = { ...prev }; delete n[directChatTarget.uid]; return n })
    }
  }, [directChatTarget?.uid])

  const totalUnread = unreadGlobal + Object.values(dmUnread).reduce((s, n) => s + n, 0)

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-night-950"
      onPointerDown={() => audioSystem.unlock()}
    >
      <style>{toastStyle}</style>

      {/* 3D World */}
      {mode === 'city' && (
        <WorldCanvas
          onNPCChat={npc => setActiveNPC(npc)}
          onEnterBuilding={enterBuilding}
          remotePlayerIds={remotePlayerIds}
          onPlayerClick={(uid, name) => setDirectChatTarget({ uid, name })}
          onPlayerContextMenu={handlePlayerContextMenu}
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

      {/* HUD overlay (player name + store toasts) */}
      <HUD />

      {/* Mission system overlays */}
      <BossHealthBar />
      <MissionPanel open={showMissions} onClose={() => setShowMissions(false)} />

      {/* Left-side quick buttons — mission + fast travel, vertically centered */}
      {mode === 'city' && !showMissions && !showFastTravel && (
        <div style={{ position: 'fixed', left: 12, top: '50%', transform: 'translateY(-50%)', zIndex: 40, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setShowMissions(true)}
            title="Missions"
            style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(124,58,237,0.85)', border: '1.5px solid rgba(124,58,237,0.5)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(124,58,237,0.4)' }}
          >🗺️</button>
          <button
            onClick={() => setShowFastTravel(true)}
            title="Fast Travel"
            style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(251,191,36,0.2)', border: '1.5px solid rgba(251,191,36,0.4)', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
          >📍</button>
        </div>
      )}

      {/* Boss spawned / defeated banner */}
      {bossBanner && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          zIndex: 460, pointerEvents: bossBanner === 'spawned' ? 'auto' : 'none',
          background: bossBanner === 'defeated' ? 'rgba(34,197,94,0.95)' : 'rgba(127,0,0,0.95)',
          border: `1px solid ${bossBanner === 'defeated' ? '#4ade80' : '#ef4444'}`,
          borderRadius: 14, padding: '14px 28px',
          color: '#fff', fontFamily: 'Nunito, sans-serif', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          animation: 'pulse 1s infinite',
        }}>
          {bossBanner === 'spawned' ? (
            <>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>💀 Shadow Vendor has appeared!</div>
              <div style={{ fontSize: 13, color: '#fca5a5', marginBottom: 10 }}>Go to city center and press F to attack</div>
              <button
                onClick={() => setBossBanner(null)}
                style={{ background: '#ef4444', border: 'none', borderRadius: 8, padding: '6px 18px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >
                Go Fight!
              </button>
            </>
          ) : (
            <div style={{ fontSize: 18, fontWeight: 800 }}>🎉 Shadow Vendor Defeated! City saved!</div>
          )}
        </div>
      )}

      {/* Single unified audio panel — top right, replaces all separate audio buttons */}
      <AudioPanel
        voiceEnabled={voice.voiceEnabled}
        pttMode={voice.pttMode}
        localSpeaking={voice.localSpeaking}
        error={voice.error}
        inputVol={voice.inputVol}
        outputVol={voice.outputVol}
        toggleVoice={voice.toggleVoice}
        togglePttMode={voice.togglePttMode}
        setInputVolume={voice.setInputVolume}
        setOutputVolume={voice.setOutputVolume}
      />

      {/* Profile button — below audio panel */}
      <button
        onClick={() => setShowProfile(true)}
        title={avatar.name}
        style={{
          position: 'fixed', top: 60, right: 12, zIndex: 40,
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

      {/* Online players — below profile */}
      <OnlinePlayersHUD
        onlinePlayers={onlinePlayers}
        mutePlayer={voice.mutePlayer}
        unmutePlayer={voice.unmutePlayer}
        isPlayerMuted={voice.isPlayerMuted}
      />

      {/* Minimap — city mode only */}
      {mode === 'city' && <Minimap isMobile={isMobile} />}

      {/* Player right-click context menu */}
      {playerCtxMenu && (
        <div
          ref={ctxMenuRef}
          style={{
            position: 'fixed',
            left: Math.min(playerCtxMenu.x, window.innerWidth  - 160),
            top:  Math.min(playerCtxMenu.y, window.innerHeight - 100),
            zIndex: 600,
            background: 'rgba(8,4,20,0.97)',
            border: '1px solid rgba(124,58,237,0.35)',
            borderRadius: 10, overflow: 'hidden',
            minWidth: 150,
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          <div style={{ padding: '8px 14px 4px', color: '#a78bfa', fontSize: 12, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {playerCtxMenu.name}
          </div>
          {[
            {
              label: '💬 Chat',
              action: () => { setDirectChatTarget({ uid: playerCtxMenu.uid, name: playerCtxMenu.name }); setPlayerCtxMenu(null) },
            },
            {
              label: voice.isPlayerMuted(playerCtxMenu.uid) ? '🔈 Unmute' : '🔇 Mute',
              action: () => {
                voice.isPlayerMuted(playerCtxMenu.uid)
                  ? voice.unmutePlayer(playerCtxMenu.uid)
                  : voice.mutePlayer(playerCtxMenu.uid)
                setPlayerCtxMenu(null)
              },
            },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                display: 'block', width: '100%', padding: '9px 14px',
                background: 'none', border: 'none', textAlign: 'left',
                color: '#e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Nunito, sans-serif',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(124,58,237,0.15)' }}
              onMouseLeave={e => { e.target.style.background = 'none' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* City wandering NPC chat */}
      <AnimatePresence>
        {mode === 'city' && activeNPC && (
          <ChatPanel key="chat" npc={activeNPC} onClose={() => setActiveNPC(null)} />
        )}
      </AnimatePresence>

      {/* Interior AI chat */}
      <AnimatePresence>
        {chatNpc && (
          <AIChat key="aichat" npc={chatNpc} onClose={() => setChatNpc(null)} />
        )}
      </AnimatePresence>

      {/* Play Game button */}
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

      {/* Active mini-game */}
      {activeGame && (
        <GameRunner gameId={activeGame} onClose={() => setActiveGame(null)} />
      )}

      {/* Profile panel */}
      <AnimatePresence>
        {showProfile && (
          <ProfilePanel
            key="profile"
            onClose={() => setShowProfile(false)}
            onOpenFastTravel={() => { setShowProfile(false); setShowFastTravel(true) }}
          />
        )}
      </AnimatePresence>

      {/* Global chat — bottom left */}
      {mode === 'city' && (
        <GlobalChat
          globalMessages={globalMessages}
          onSendGlobal={sendGlobalMessage}
          onlineCount={onlinePlayers.length}
          open={globalChatOpen}
          onOpenChange={setGlobalChatOpen}
          unreadCount={totalUnread}
        />
      )}

      {/* Direct message panel */}
      {directChatTarget && (
        <DirectChat
          myId={user?.id}
          myName={avatar.name}
          targetId={directChatTarget.uid}
          targetName={directChatTarget.name}
          onClose={() => setDirectChatTarget(null)}
        />
      )}

      {/* Toast notifications — bottom left above chat button */}
      <MsgToast toasts={msgToasts} onDismiss={dismissToast} />

      {/* Fast Travel panel */}
      <FastTravel
        open={showFastTravel}
        onClose={() => setShowFastTravel(false)}
        onTravel={(msg) => {
          const id = ++toastIdRef.current
          setMsgToasts(prev => [...prev.slice(-2), { id, type: 'global', fromName: '📍 Travel', text: msg, onClick: null }])
        }}
      />

      {/* Daily bonus popup */}
      {dailyBonus && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 700,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setDailyBonus(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'rgba(8,4,20,0.97)', border: '1.5px solid rgba(251,191,36,0.5)',
            borderRadius: 20, padding: '28px 32px', textAlign: 'center',
            fontFamily: 'Nunito, sans-serif', maxWidth: 320,
            boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
          }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎁</div>
            <div style={{ color: '#fbbf24', fontWeight: 800, fontSize: 20, marginBottom: 6 }}>Daily Bonus!</div>
            <div style={{ color: '#e2e8f0', fontSize: 14, marginBottom: 16 }}>
              +{dailyBonus.coins} 🪙 Coins &nbsp;·&nbsp; +{dailyBonus.tickets} 🎟️ Ticket
            </div>
            {dailyBonus.streakBonus && (
              <div style={{ color: '#4ade80', fontSize: 13, marginBottom: 12, background: 'rgba(74,222,128,0.1)', borderRadius: 8, padding: '8px 14px' }}>
                🎉 7-Day Streak Bonus! +20 💎 Gems
              </div>
            )}
            <div style={{ color: '#f59e0b', fontSize: 13, marginBottom: 18 }}>
              🔥 {dailyBonus.streak}-day login streak
            </div>
            <button
              onClick={() => setDailyBonus(null)}
              style={{ padding: '10px 32px', background: 'linear-gradient(135deg,#f59e0b,#facc15)', border: 'none', borderRadius: 10, color: '#000', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Nunito, sans-serif' }}
            >
              Claim!
            </button>
          </div>
        </div>
      )}

      {/* Mobile touch controls */}
      {isMobile && !activeGame && <MobileControls />}

      {/* Fade overlay for building transitions */}
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
