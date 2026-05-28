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
import GameHub from '@/components/GameHub'
import Phone, { PhoneButton, phoneStyle } from '@/components/Phone'
import { usePhone } from '@/hooks/usePhone'
import PlayerRadar from '@/components/PlayerRadar'
import { initGameState, GAME_NAMES, GAME_EMOJIS } from '@/lib/gameState'
import { showSpeechBubble } from '@/world/RemotePlayer'
import Shop, { ShopButton } from '@/components/Shop'
import HousePanel, { HouseQuickButton } from '@/components/HousePanel'
import HouseInterior from '@/world/HouseInterior'
import { initHouse, getHouseState, onHouseUpdate } from '@/lib/houseService'

export default function Game() {
  const avatar   = useStore(s => s.avatar)
  const isMobile = useMobile()
  const { user } = useUser()

  const { remotePlayerIds, onlinePlayers, globalMessages, sendGlobalMessage } =
    useMultiplayer({ userId: user?.id, avatar })

  const voice = useVoiceChat({ userId: user?.id, onlinePlayers })
  const phone = usePhone({ userId: user?.id, userName: avatar.name, onlinePlayers })

  const [showMissions,    setShowMissions]    = useState(false)
  const [bossBanner,      setBossBanner]      = useState(null)
  const [showFastTravel,  setShowFastTravel]  = useState(false)
  const [dailyBonus,      setDailyBonus]      = useState(null)
  const [showShop,        setShowShop]        = useState(false)
  const [showHouse,       setShowHouse]       = useState(false)
  const [showHouseInterior, setShowHouseInterior] = useState(false)
  const [houseAction,    setHouseAction]     = useState(null)   // 'rest'|'sleep'|null
  const [spawnedInHouse, setSpawnedInHouse]  = useState(false)
  const [showOrbPanel,    setShowOrbPanel]    = useState(false)
  const [dmFlash,         setDmFlash]         = useState(false)
  const [showGameHub,     setShowGameHub]     = useState(false)
  const [activeNPC,         setActiveNPC]         = useState(null)
  const [showProfile,       setShowProfile]       = useState(false)
  const [directChatTarget,  setDirectChatTarget]  = useState(null)
  const [playerCtxMenu,     setPlayerCtxMenu]     = useState(null)
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
  useEffect(() => { if (activeNPC?.name) recordNPCTalk(activeNPC.name) }, [activeNPC?.name])

  const setWallet        = useStore(s => s.setWallet)
  const setOwnedOutfits  = useStore(s => s.setOwnedOutfits)
  const setLoginStreak   = useStore(s => s.setLoginStreak)

  useEffect(() => onEconomyUpdate((eco) => {
    setWallet({ coins: eco.coins, gems: eco.gems, tickets: eco.tickets })
    setOwnedOutfits(eco.ownedOutfits)
    setLoginStreak(eco.loginStreak)
  }), [])

  useEffect(() => {
    if (!user?.id) return
    initEconomy(user.id).then(bonus => { if (bonus?.given) setDailyBonus(bonus) })
    initHouse(user.id, avatar.name).then(hs => {
      if (!hs) return
      const { unpaid, status } = hs
      // Issue 6: spawn inside house on first session login
      if (hs.position && !spawnedInHouse) {
        setSpawnedInHouse(true)
        setShowHouseInterior(true)
        setHouseAction(null)
      }
      if (unpaid > 0) {
        const id = ++toastIdRef.current
        setMsgToasts(prev => [...prev.slice(-2), {
          id, type: 'global',
          fromName: status === 'evicted' ? '🏠 EVICTED' : status === 'eviction-warning' ? '🏠 Eviction Warning' : '🏠 House Bills Due',
          text: `${unpaid} coins owed on your house${status === 'evicted' ? ' — pay fine to return' : ' — tap to manage'}`,
          duration: 12000,
          onClick: () => setShowHouse(true),
        }])
      }
    })
    initMissions(user.id, avatar.name)
    initBoss()
    initGameState(user.id, avatar.name)
    startPassiveIncome()
    return () => stopPassiveIncome()
  }, [user?.id])

  useEffect(() => {
    const handler = ({ detail }) => {
      if (detail?.coins) { addCoins(detail.coins); audioSystem.playCoinsEarned() }
      if (detail?.gems)  addGems(detail.gems)
    }
    window.addEventListener('economy-reward', handler)
    return () => window.removeEventListener('economy-reward', handler)
  }, [])

  useEffect(() => {
    const onMissionUnlocked = ({ detail }) => {
      audioSystem.playMissionComplete()
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), {
        id, type: 'global',
        fromName: `🗺️ New Mission: ${detail.title}`,
        text: detail.hint || detail.title,
        duration: 10000,
        onClick: () => setShowMissions(true),
      }])
    }
    const onBossSpawned = () => {
      setBossBanner('spawned')
      audioSystem.playBossAppear()
      setTimeout(() => setBossBanner(null), 8000)
    }
    const onBossDefeated = () => {
      setBossBanner('defeated')
      audioSystem.playBossDefeated()
      setTimeout(() => setBossBanner(null), 8000)
    }
    const onBossActivate = () => { spawnBoss() }
    const onPlayerInteract = ({ detail }) => {
      if (detail?.nearBoss) { attackBoss(user?.id); window.dispatchEvent(new CustomEvent('boss-hit')) }
      if (detail?.nearOrb)  { setShowOrbPanel(true) }
    }
    const onChallengeIncoming = ({ detail: ch }) => {
      if (!ch) return
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), {
        id, type: 'challenge',
        fromName: '⚔️ Challenge Received',
        text: `${ch.challenger_name} challenged you to ${GAME_NAMES[ch.game_id]}! Beat their score of ${ch.challenger_score} pts`,
        duration: 12000,
        actions: [
          { label: '⚔️ Accept', primary: true, action: () => setShowGameHub(true) },
          { label: 'Later', primary: false, action: () => {} },
        ],
      }])
      audioSystem.playNotification?.() || audioSystem.playChime?.()
    }
    const onChallengeResolved = ({ detail: ch }) => {
      if (!ch) return
      const won = ch.challenged_uid === user?.id
        ? ch.status === 'challenged_won'
        : ch.status === 'challenger_won'
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), {
        id, type: 'global',
        fromName: won ? '🏆 Challenge Won' : '💀 Challenge Lost',
        text: won
          ? `You beat ${ch.challenger_uid === user?.id ? ch.challenged_name : ch.challenger_name} in ${GAME_NAMES[ch.game_id]}!`
          : `${ch.challenger_uid === user?.id ? ch.challenged_name : ch.challenger_name} beat you in ${GAME_NAMES[ch.game_id]}!`,
        onClick: null,
      }])
    }
    const onAchievement = ({ detail }) => {
      if (!detail?.text) return
      audioSystem.playLevelUp()
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), { id, type: 'global', fromName: '🏅 Achievement', text: detail.text, onClick: null }])
    }
    const onHouseEvicted = () => {
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), {
        id, type: 'global',
        fromName: '🏠 EVICTED',
        text: 'You have been evicted! Pay 100 coin fine to return.',
        duration: 15000,
        onClick: () => setShowHouse(true),
      }])
    }
    window.addEventListener('house-evicted', onHouseEvicted)
    window.addEventListener('mission-unlocked',    onMissionUnlocked)
    window.addEventListener('boss-spawned',        onBossSpawned)
    window.addEventListener('boss-defeated',       onBossDefeated)
    window.addEventListener('boss-activate',       onBossActivate)
    window.addEventListener('player-interact',     onPlayerInteract)
    window.addEventListener('challenge-incoming',  onChallengeIncoming)
    window.addEventListener('challenge-resolved',  onChallengeResolved)
    window.addEventListener('achievement',         onAchievement)
    const onNameUpdated = ({ detail }) => {
      if (!detail?.name) return
      const id = ++toastIdRef.current
      setMsgToasts(prev => [...prev.slice(-2), {
        id, type: 'global',
        fromName: '✏️ Name Updated',
        text: `Name updated to "${detail.name}"`,
        onClick: null,
      }])
    }
    window.addEventListener('name-updated', onNameUpdated)
    return () => {
      window.removeEventListener('name-updated',        onNameUpdated)
      window.removeEventListener('house-evicted',       onHouseEvicted)
      window.removeEventListener('mission-unlocked',    onMissionUnlocked)
      window.removeEventListener('boss-spawned',        onBossSpawned)
      window.removeEventListener('boss-defeated',       onBossDefeated)
      window.removeEventListener('boss-activate',       onBossActivate)
      window.removeEventListener('player-interact',     onPlayerInteract)
      window.removeEventListener('challenge-incoming',  onChallengeIncoming)
      window.removeEventListener('challenge-resolved',  onChallengeResolved)
      window.removeEventListener('achievement',         onAchievement)
    }
  }, [user?.id])

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

  const todayRef = useRef(new Date().getDate())
  useEffect(() => {
    const id = setInterval(() => {
      const day = new Date().getDate()
      if (day !== todayRef.current) {
        todayRef.current = day
        window.dispatchEvent(new CustomEvent('daily-reset'))
        audioSystem.playMissionComplete?.()
        const tid = ++toastIdRef.current
        setMsgToasts(prev => [...prev.slice(-2), {
          id: tid, type: 'global',
          fromName: '🌅 New Day!',
          text: 'New day, new missions available!',
          duration: 8000,
          onClick: () => setShowMissions(true),
        }])
      }
    }, 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const handler = () => setActiveNPC(null)
    window.addEventListener('npc-auto-close', handler)
    return () => window.removeEventListener('npc-auto-close', handler)
  }, [])

  const [mode,           setMode]           = useState('city')
  const [activeBuilding, setActiveBuilding] = useState(null)
  const [fading,         setFading]         = useState(false)
  const [chatNpc,        setChatNpc]        = useState(null)
  const [showGameMenu,   setShowGameMenu]   = useState(false)
  const [activeGame,     setActiveGame]     = useState(null)
  const buildingGames = activeBuilding ? (LOCATION_GAMES[activeBuilding] || []) : []

  function enterBuilding(id, action = null) {
    if (id === 'gamearea') { setShowGameHub(true); return }
    if (id === 'playerhouse') {
      setHouseAction(action)
      setShowHouseInterior(true)
      audioSystem.playEnter()
      audioSystem.startIndoor()
      return
    }
    if (!INTERIOR_DEFS[id]) return
    completeDailyMission('daily_building')
    audioSystem.playEnter()
    audioSystem.startIndoor()
    audioSystem.updateLocation(0, 0, true)
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
    audioSystem.playExit()
    audioSystem.stopIndoor()
    audioSystem.updateLocation(0, 0, false)
    setFading(true)
    setTimeout(() => {
      setMode('city')
      setActiveBuilding(null)
      requestAnimationFrame(() => requestAnimationFrame(() => setFading(false)))
    }, 350)
  }

  const [globalChatOpen, setGlobalChatOpen] = useState(false)
  const [unreadGlobal,   setUnreadGlobal]   = useState(0)
  const [dmUnread,       setDmUnread]       = useState({})
  const [msgToasts,      setMsgToasts]      = useState([])
  const toastIdRef = useRef(0)

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
        if (payload.fromId) showSpeechBubble(payload.fromId, payload.text, 'global')
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
          if (payload.fromId) showSpeechBubble(payload.fromId, payload.text, 'dm')
          setDmFlash(true)
          setTimeout(() => setDmFlash(false), 900)
          const id = ++toastIdRef.current
          setMsgToasts(prev => [...prev.slice(-2), {
            id, type: 'dm',
            fromId: payload.fromId, fromName: payload.fromName, text: payload.text,
            onClick: () => setDirectChatTarget({ uid: payload.fromId, name: payload.fromName }),
          }])
        }
      }
    })
  }, [])

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
      <style>{toastStyle + phoneStyle}</style>

      {mode === 'city' && (
        <WorldCanvas
          onNPCChat={npc => setActiveNPC(npc)}
          onEnterBuilding={enterBuilding}
          remotePlayerIds={remotePlayerIds}
          onPlayerClick={(uid, name) => setDirectChatTarget({ uid, name })}
          onPlayerContextMenu={handlePlayerContextMenu}
        />
      )}

      {mode === 'interior' && activeBuilding && (
        <InteriorScene
          buildingId={activeBuilding}
          avatar={avatar}
          onExit={exitBuilding}
          onInteract={setChatNpc}
        />
      )}

      <HUD onOpenShop={() => setShowShop(true)} />
      <BossHealthBar />
      <MissionPanel open={showMissions} onClose={() => setShowMissions(false)} />
      {mode === 'city' && <PlayerRadar />}

      {/* DM screen flash */}
      {dmFlash && (
        <div
          className="fixed inset-0 z-[200] pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 60px 20px rgba(0,229,255,0.55)',
            animation: 'dmFlash 0.9s ease-out forwards',
          }}
        />
      )}
      <style>{`
        @keyframes dmFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Orb examine panel */}
      {showOrbPanel && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center backdrop-blur-[6px]"
          style={{ background: 'rgba(0,0,0,0.72)' }}
        >
          <div
            className="rounded-[20px] max-w-[480px] w-[90%] text-center font-body"
            style={{
              background: 'linear-gradient(135deg, rgba(20,10,40,0.98), rgba(40,20,10,0.98))',
              border: '2px solid rgba(255,215,0,0.5)',
              padding: '36px 40px',
              boxShadow: '0 0 60px rgba(255,215,0,0.25), 0 20px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div className="text-[56px] mb-3">✨</div>
            <h2 className="text-[22px] font-extrabold mb-3 mt-0" style={{ color: '#ffd700' }}>
              A Hidden Note
            </h2>
            <p className="text-[15px] leading-[1.7] mb-2" style={{ color: '#fffde7' }}>
              You find a crumpled note wedged under the glowing object. The text is scrambled — fragments of coordinates, names, and a symbol you don't recognise.
            </p>
            <p className="text-[14px] leading-[1.6] mb-7 opacity-90 text-yellow-400">
              <em>&quot;...shadow... city center... must not reach...&quot;</em>
            </p>
            <button
              onClick={() => {
                setShowOrbPanel(false)
                completeMission('m1_3')
                window.dispatchEvent(new CustomEvent('orb-collected'))
              }}
              className="border-0 rounded-xl font-extrabold text-base cursor-pointer font-body"
              style={{
                background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                padding: '12px 36px',
                color: '#1a0a00',
                letterSpacing: 0.5,
                boxShadow: '0 4px 20px rgba(245,158,11,0.5)',
              }}
            >
              Pocket the Note
            </button>
          </div>
        </div>
      )}

      {/* Left quick buttons */}
      {mode === 'city' && !showMissions && !showFastTravel && !showHouse && (
        <div className="fixed left-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2">
          <button
            onClick={() => setShowMissions(true)}
            title="Missions"
            className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0"
            style={{ background: 'rgba(124,58,237,0.85)', border: '1.5px solid rgba(124,58,237,0.5)', boxShadow: '0 2px 12px rgba(124,58,237,0.4)' }}
          >🗺️</button>
          <button
            onClick={() => setShowFastTravel(true)}
            title="Fast Travel"
            className="w-[42px] h-[42px] rounded-xl cursor-pointer text-xl flex items-center justify-center font-body border-0"
            style={{ background: 'rgba(251,191,36,0.2)', border: '1.5px solid rgba(251,191,36,0.4)', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
          >📍</button>
          <HouseQuickButton onClick={() => setShowHouse(true)} />
          <ShopButton onClick={() => setShowShop(true)} />
        </div>
      )}

      {/* Boss banner */}
      {bossBanner && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[460] rounded-[14px] text-white font-body text-center"
          style={{
            pointerEvents: bossBanner === 'spawned' ? 'auto' : 'none',
            background: bossBanner === 'defeated' ? 'rgba(34,197,94,0.95)' : 'rgba(127,0,0,0.95)',
            border: `1px solid ${bossBanner === 'defeated' ? '#4ade80' : '#ef4444'}`,
            padding: '14px 28px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            animation: 'pulse 1s infinite',
          }}
        >
          {bossBanner === 'spawned' ? (
            <>
              <div className="text-lg font-extrabold mb-[6px]">💀 Shadow Vendor has appeared!</div>
              <div className="text-[13px] text-red-300 mb-[10px]">Go to city center and press F to attack</div>
              <button
                onClick={() => setBossBanner(null)}
                className="bg-red-500 border-0 rounded-lg text-white font-bold cursor-pointer text-[13px] font-body"
                style={{ padding: '6px 18px' }}
              >
                Go Fight!
              </button>
            </>
          ) : (
            <div className="text-lg font-extrabold">🎉 Shadow Vendor Defeated! City saved!</div>
          )}
        </div>
      )}

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

      {/* Profile button */}
      <button
        onClick={() => setShowProfile(true)}
        title={avatar.name}
        className="fixed top-[60px] right-3 z-40 w-[34px] h-[34px] rounded-full cursor-pointer p-0 overflow-hidden flex items-center justify-center border-0"
        style={{
          background: user?.imageUrl ? 'transparent' : 'rgba(124,58,237,0.8)',
          border: '1.5px solid rgba(124,58,237,0.5)',
        }}
      >
        {user?.imageUrl
          ? <img src={user.imageUrl} alt="" className="w-full h-full object-cover" />
          : <span className="text-white text-[14px] font-bold">{avatar.name?.[0]?.toUpperCase() || '?'}</span>
        }
      </button>

      <TimeWeatherHUD />

      <OnlinePlayersHUD
        onlinePlayers={onlinePlayers}
        mutePlayer={voice.mutePlayer}
        unmutePlayer={voice.unmutePlayer}
        isPlayerMuted={voice.isPlayerMuted}
      />

      {mode === 'city' && <Minimap isMobile={isMobile} />}

      {/* Player context menu */}
      {playerCtxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-[600] rounded-[10px] overflow-hidden min-w-[150px] font-body"
          style={{
            left: Math.min(playerCtxMenu.x, window.innerWidth  - 160),
            top:  Math.min(playerCtxMenu.y, window.innerHeight - 100),
            background: 'rgba(8,4,20,0.97)',
            border: '1px solid rgba(124,58,237,0.35)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          <div
            className="text-violet-400 text-[12px] font-bold"
            style={{ padding: '8px 14px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
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
              className="block w-full text-left text-slate-200 text-[13px] font-semibold cursor-pointer font-body bg-transparent border-0 hover:bg-[rgba(124,58,237,0.15)]"
              style={{ padding: '9px 14px' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {mode === 'city' && activeNPC && (
          <ChatPanel key="chat" npc={activeNPC} onClose={() => setActiveNPC(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatNpc && (
          <AIChat key="aichat" npc={chatNpc} onClose={() => setChatNpc(null)} />
        )}
      </AnimatePresence>

      {/* Play Game button */}
      {mode === 'interior' && buildingGames.length > 0 && !chatNpc && !activeGame && (
        <button
          onClick={() => { audioSystem.playClick(); setShowGameMenu(true) }}
          className="absolute bottom-7 left-1/2 -translate-x-1/2 border-0 rounded-xl text-white font-bold text-[14px] cursor-pointer font-body z-50"
          style={{
            background: 'linear-gradient(135deg,#7c3aed,#ec4899)',
            padding: '10px 28px',
            boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
          }}
        >
          🎮 Play a Game
        </button>
      )}

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

      {activeGame && (
        <GameRunner gameId={activeGame} onClose={() => setActiveGame(null)} />
      )}

      <AnimatePresence>
        {showProfile && (
          <ProfilePanel
            key="profile"
            onClose={() => setShowProfile(false)}
            onOpenFastTravel={() => { setShowProfile(false); setShowFastTravel(true) }}
          />
        )}
      </AnimatePresence>

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

      {directChatTarget && (
        <DirectChat
          myId={user?.id}
          myName={avatar.name}
          targetId={directChatTarget.uid}
          targetName={directChatTarget.name}
          onClose={() => setDirectChatTarget(null)}
        />
      )}

      <MsgToast toasts={msgToasts} onDismiss={dismissToast} />

      <GameHub
        open={showGameHub}
        onClose={() => setShowGameHub(false)}
        onlinePlayers={onlinePlayers}
        myUid={user?.id}
        myName={avatar.name}
      />

      <FastTravel
        open={showFastTravel}
        onClose={() => setShowFastTravel(false)}
        onOpenShop={() => { setShowFastTravel(false); setShowShop(true) }}
        onTravel={(msg) => {
          const id = ++toastIdRef.current
          setMsgToasts(prev => [...prev.slice(-2), { id, type: 'global', fromName: '📍 Travel', text: msg, onClick: null }])
        }}
      />

      {/* Daily bonus popup */}
      {dailyBonus && (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center backdrop-blur-[6px]"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setDailyBonus(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="rounded-[20px] text-center font-body max-w-[320px]"
            style={{
              background: 'rgba(8,4,20,0.97)',
              border: '1.5px solid rgba(251,191,36,0.5)',
              padding: '28px 32px',
              boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
            }}
          >
            <div className="text-[40px] mb-[10px]">🎁</div>
            <div className="text-yellow-400 font-extrabold text-xl mb-[6px]">Daily Bonus!</div>
            <div className="text-slate-200 text-[14px] mb-4">
              +{dailyBonus.coins} 🪙 Coins &nbsp;·&nbsp; +{dailyBonus.tickets} 🎟️ Ticket
            </div>
            {dailyBonus.streakBonus && (
              <div
                className="text-green-400 text-[13px] mb-3 rounded-lg"
                style={{ background: 'rgba(74,222,128,0.1)', padding: '8px 14px' }}
              >
                🎉 7-Day Streak Bonus! +20 💎 Gems
              </div>
            )}
            <div className="text-amber-400 text-[13px] mb-[18px]">
              🔥 {dailyBonus.streak}-day login streak
            </div>
            <button
              onClick={() => setDailyBonus(null)}
              className="border-0 rounded-[10px] text-black font-extrabold text-[14px] cursor-pointer font-body"
              style={{
                padding: '10px 32px',
                background: 'linear-gradient(135deg,#f59e0b,#facc15)',
              }}
            >
              Claim!
            </button>
          </div>
        </div>
      )}

      <Shop open={showShop} onClose={() => setShowShop(false)} />

      <HousePanel
        open={showHouse}
        onClose={() => setShowHouse(false)}
        onEnterHouse={(action) => {
          setShowHouse(false)
          enterBuilding('playerhouse', action)
        }}
      />

      {showHouseInterior && (
        <HouseInterior
          initialAction={houseAction}
          onExit={() => {
            setShowHouseInterior(false)
            setHouseAction(null)
            audioSystem.stopIndoor()
            audioSystem.playExit()
          }}
        />
      )}

      {isMobile && !activeGame && <MobileControls />}

      <PhoneButton
        onClick={() => {
          if (phone.callStatus === 'incoming') { phone.acceptCall(); return }
          phone.setPhoneOpen(o => !o)
        }}
        callStatus={phone.callStatus}
        missedCount={phone.missedCalls.length}
        isMobile={isMobile}
      />
      <Phone
        myId={user?.id}
        myName={avatar.name}
        onlinePlayers={onlinePlayers}
        phoneOpen={phone.phoneOpen}
        onToggle={() => phone.setPhoneOpen(o => !o)}
        callStatus={phone.callStatus}
        callMeta={phone.callMeta}
        callElapsed={phone.callElapsed}
        callError={phone.callError}
        missedCalls={phone.missedCalls}
        clearMissed={phone.clearMissed}
        npcSession={phone.npcSession}
        npcTyping={phone.npcTyping}
        npcFreeLeft={phone.npcFreeLeft}
        callCost={phone.callCost}
        lowCoins={phone.lowCoins}
        micMuted={phone.micMuted}
        onMakeCall={phone.makeCall}
        onAcceptCall={phone.acceptCall}
        onRejectCall={phone.rejectCall}
        onEndCall={phone.endCall}
        onToggleMic={phone.toggleMic}
        onCallNPC={phone.callNPC}
        onSendNpcMessage={phone.sendNpcMessage}
        onOpenShop={() => setShowShop(true)}
        playerCoins={getEconomyState().coins}
      />

      {/* Fade overlay for building transitions */}
      <div
        className="absolute inset-0 bg-black z-[1000] transition-opacity duration-[350ms]"
        style={{ opacity: fading ? 1 : 0, pointerEvents: fading ? 'all' : 'none' }}
      />
    </div>
  )
}
