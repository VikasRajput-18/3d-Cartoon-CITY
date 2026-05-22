import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { minimapState } from '@/lib/minimapState'
import { remotePlayersRef } from '@/lib/multiplayerState'

const BROADCAST_MS = 80    // position update interval (ms)
const HEARTBEAT_MS = 3000  // players table upsert interval
const OFFLINE_MS   = 10000 // prune players silent for 10 s
const TELEPORT_SQ  = 400   // ignore position jumps > 20 units — bug 2

export function useMultiplayer({ userId, avatar }) {
  const [remotePlayerIds, setRemotePlayerIds] = useState([])
  const [onlinePlayers,   setOnlinePlayers]   = useState([])
  const [globalMessages,  setGlobalMessages]  = useState([])

  const channelRef = useRef(null)
  const avatarRef  = useRef(avatar)
  useEffect(() => { avatarRef.current = avatar }, [avatar])

  // ── Global chat ──────────────────────────────────────────────────────────
  const sendGlobalMessage = useCallback(async (text) => {
    if (!supabase || !text.trim()) return
    await supabase.from('messages').insert({
      uid:           userId,
      name:          avatarRef.current.name,
      avatar_outfit: avatarRef.current.outfit,
      content:       text.trim(),
      type:          'global',
    })
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return

    // Fetch last 50 global messages
    supabase
      .from('messages')
      .select('*')
      .or('type.is.null,type.eq.global')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setGlobalMessages(data.reverse()) })

    // Subscribe to new global messages (filter non-global types client-side)
    const globalSub = supabase
      .channel('global-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: row }) => {
        if (row.type && row.type !== 'global') return
        setGlobalMessages(prev => [...prev.slice(-49), row])
      })
      .subscribe()

    // ── Helper: apply a DB players row ───────────────────────────────────
    // Called on initial fetch and on every postgres_changes event.
    // Filter out self client-side (no server-side filter, per spec).
    const applyPlayerRow = (row) => {
      if (!row || row.uid === userId) return

      if (!row.is_online) {
        remotePlayersRef.current.delete(row.uid)
        setRemotePlayerIds(prev => prev.filter(id => id !== row.uid))
        setOnlinePlayers(prev => prev.filter(p => p.uid !== row.uid))
        return
      }

      const existing = remotePlayersRef.current.get(row.uid) || {}

      // Teleport guard — ignore jumps > 20 units (bad packet / first row)
      if (existing.x !== undefined) {
        const tdx = row.x - existing.x
        const tdz = row.z - existing.z
        if (tdx * tdx + tdz * tdz > TELEPORT_SQ) return
      }

      const posBuffer = existing.posBuffer || []
      posBuffer.push({ x: row.x, z: row.z, facing: row.facing })
      while (posBuffer.length > 3) posBuffer.shift()

      remotePlayersRef.current.set(row.uid, {
        ...existing,
        posBuffer,
        is_moving:     !!row.is_moving,
        is_in_vehicle: !!row.is_in_vehicle,
        vehicle_type:  row.vehicle_type || '',
        name:    row.name   || existing.name   || 'Player',
        outfit:  row.outfit || existing.outfit || 'casual',
        skin:    row.skin   || existing.skin   || '#F4C08A',
        x:      existing.x  ?? row.x,
        z:      existing.z  ?? row.z,
        facing: existing.facing ?? row.facing,
        lastSeen: Date.now(),
      })

      // Ensure the player is rendered even if Presence hasn't fired yet
      setRemotePlayerIds(prev => prev.includes(row.uid) ? prev : [...prev, row.uid])
      setOnlinePlayers(prev => {
        const entry = { uid: row.uid, name: row.name || 'Player', outfit: row.outfit || 'casual' }
        const exists = prev.find(p => p.uid === row.uid)
        if (exists) return prev.map(p => p.uid === row.uid ? entry : p)
        return [...prev, entry]
      })
    }

    // ── Fetch existing online players from DB (fixes one-sided visibility) ─
    supabase
      .from('players')
      .select('*')
      .eq('is_online', true)
      .neq('uid', userId)
      .then(({ data }) => { data?.forEach(applyPlayerRow) })

    // ── Subscribe to ALL changes on players table — filter self client-side ─
    const playersSub = supabase
      .channel('players-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, ({ new: row }) => {
        applyPlayerRow(row)
      })
      .subscribe()

    // ── Main multiplayer channel — fixed name so all clients share it ────
    const channel = supabase.channel('game-presence', {
      config: { presence: { key: userId } },
    })
    channelRef.current = channel

    // Presence: adds new players; keeps DB-only players that are still fresh
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const ids   = Object.keys(state).filter(id => id !== userId)

      setOnlinePlayers(prev => {
        const presencePlayers = Object.entries(state)
          .filter(([id]) => id !== userId)
          .map(([id, presences]) => ({
            uid:    id,
            name:   presences[0]?.name   || 'Player',
            outfit: presences[0]?.outfit || 'casual',
          }))
        // Also keep any DB-only players still in remotePlayersRef
        const dbOnly = prev.filter(p =>
          !presencePlayers.find(q => q.uid === p.uid) &&
          remotePlayersRef.current.has(p.uid)
        )
        return [...presencePlayers, ...dbOnly]
      })

      setRemotePlayerIds(prev => {
        const presenceSet = new Set(ids)
        // Remove players absent from Presence only if they also have no recent DB data
        const kept = prev.filter(id => {
          if (presenceSet.has(id)) return true
          const data = remotePlayersRef.current.get(id)
          return data && (Date.now() - data.lastSeen < OFFLINE_MS)
        })
        // Clean up remotePlayersRef for truly-gone players
        prev.filter(id => !kept.includes(id)).forEach(id => {
          remotePlayersRef.current.delete(id)
        })
        return Array.from(new Set([...kept, ...ids]))
      })
    })

    // ── Position broadcast receiver ──────────────────────────────────────
    // All position data goes into remotePlayersRef (module-level Map) so
    // RemotePlayer components consume it in useFrame without React re-renders.
    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload?.uid || payload.uid === userId) return
      const existing = remotePlayersRef.current.get(payload.uid) || {}

      if (existing.x !== undefined) {
        const tdx = payload.x - existing.x
        const tdz = payload.z - existing.z
        if (tdx * tdx + tdz * tdz > TELEPORT_SQ) return
      }

      let is_moving = payload.is_moving
      if (is_moving === undefined) {
        const last = existing.lastReceivedPos
        if (last) {
          const mdx = payload.x - last.x
          const mdz = payload.z - last.z
          is_moving = (mdx * mdx + mdz * mdz) > 0.0025
        } else {
          is_moving = false
        }
      }

      const posBuffer = existing.posBuffer || []
      posBuffer.push({ x: payload.x, z: payload.z, facing: payload.facing })
      while (posBuffer.length > 3) posBuffer.shift()

      remotePlayersRef.current.set(payload.uid, {
        ...existing,
        posBuffer,
        is_moving,
        is_in_vehicle: !!payload.is_in_vehicle,
        vehicle_type:  payload.vehicle_type || '',
        lastReceivedPos: { x: payload.x, z: payload.z },
        anim:    payload.anim,
        name:    payload.name   || existing.name   || 'Player',
        outfit:  payload.outfit || existing.outfit || 'casual',
        skin:    payload.skin   || existing.skin   || '#F4C08A',
        x:      existing.x      ?? payload.x,
        z:      existing.z      ?? payload.z,
        facing: existing.facing ?? payload.facing,
        lastSeen: Date.now(),
      })
    })

    // ── Upsert own row to players table ──────────────────────────────────
    const upsertSelf = () => {
      supabase.from('players').upsert({
        uid:          userId,
        name:         avatarRef.current.name,
        outfit:       avatarRef.current.outfit,
        skin:         avatarRef.current.skin,
        x:            minimapState.playerX,
        z:            minimapState.playerZ,
        facing:       minimapState.playerFacing,
        is_moving:    !!minimapState.isMoving,
        is_in_vehicle: !!minimapState.drivingType,
        vehicle_type: minimapState.drivingType ?? '',
        is_online:    true,
        last_seen:    new Date().toISOString(),
      }).then(() => {})
    }

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return
      await channel.track({
        uid:    userId,
        name:   avatarRef.current.name,
        outfit: avatarRef.current.outfit,
      })
      // Immediately broadcast own position so existing players see us right away
      channel.send({
        type: 'broadcast', event: 'pos',
        payload: {
          uid:          userId,
          x:            minimapState.playerX,
          z:            minimapState.playerZ,
          facing:       minimapState.playerFacing,
          is_moving:    false,
          is_in_vehicle: !!minimapState.drivingType,
          vehicle_type: minimapState.drivingType ?? '',
          anim:         'idle',
          name:         avatarRef.current.name,
          outfit:       avatarRef.current.outfit,
          skin:         avatarRef.current.skin,
        },
      })
      // Upsert to DB so players joining after us can read our position
      upsertSelf()
    })

    // Send position every 80ms via broadcast (fast, low-latency)
    const posInterval = setInterval(() => {
      if (channelRef.current !== channel) return
      const moving = minimapState.isMoving
      channel.send({
        type: 'broadcast', event: 'pos',
        payload: {
          uid:          userId,
          x:            minimapState.playerX,
          z:            minimapState.playerZ,
          facing:       minimapState.playerFacing,
          is_moving:    moving,
          is_in_vehicle: !!minimapState.drivingType,
          vehicle_type: minimapState.drivingType ?? '',
          anim:         minimapState.drivingType ? 'driving' : (moving ? 'walk' : 'idle'),
          name:         avatarRef.current.name,
          outfit:       avatarRef.current.outfit,
          skin:         avatarRef.current.skin,
        },
      })
    }, BROADCAST_MS)

    // Heartbeat: keep our DB row fresh so late joiners always find us
    const heartbeatInterval = setInterval(upsertSelf, HEARTBEAT_MS)

    // Prune players silent for more than OFFLINE_MS
    const cleanupInterval = setInterval(() => {
      const now     = Date.now()
      let   changed = false
      remotePlayersRef.current.forEach((data, id) => {
        if (now - data.lastSeen > OFFLINE_MS) {
          remotePlayersRef.current.delete(id)
          changed = true
        }
      })
      if (changed) setRemotePlayerIds(prev => prev.filter(id => remotePlayersRef.current.has(id)))
    }, 5000)

    const onUnload = () => {
      channel.untrack()
      supabase.from('players').upsert({
        uid: userId, is_online: false, last_seen: new Date().toISOString(),
      }).then(() => {})
      supabase.removeChannel(channel)
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      clearInterval(posInterval)
      clearInterval(heartbeatInterval)
      clearInterval(cleanupInterval)
      window.removeEventListener('beforeunload', onUnload)
      // Mark self offline so other clients remove us immediately via postgres_changes
      supabase.from('players').upsert({
        uid: userId, is_online: false, last_seen: new Date().toISOString(),
      }).then(() => {})
      supabase.removeChannel(channel)
      supabase.removeChannel(globalSub)
      supabase.removeChannel(playersSub)
      channelRef.current = null
    }
  }, [userId])

  return { remotePlayerIds, onlinePlayers, globalMessages, sendGlobalMessage }
}
