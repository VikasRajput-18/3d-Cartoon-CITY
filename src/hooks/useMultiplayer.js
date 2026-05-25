import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { minimapState } from '@/lib/minimapState'
import { remotePlayersRef } from '@/lib/multiplayerState'
import { vehicleState } from '@/lib/vehicleState'
import { voiceState } from '@/lib/voiceState'
import { emitChatNotification } from '@/lib/chatNotifications'
import { appendDmCache, getDmCache } from '@/lib/chatCache'

const BROADCAST_MS   = 80     // position broadcast interval (ms)
const OFFLINE_MS     = 15000  // prune players silent for 15 s

// Module-level rate-limiter: never write to players table more than once per 3 s
let lastDbUpsertTime = 0
function canUpsert() {
  const now = Date.now()
  if (now - lastDbUpsertTime < 3000) return false
  lastDbUpsertTime = now
  return true
}

// ── Apply a players-table row into remotePlayersRef ───────────────────────────
// DB columns: id (= Clerk UID), position_x, position_z, facing
function applyPlayerRow(row) {
  const uid      = row.id   // DB primary key is "id", value is the Clerk UID
  if (!uid) return
  const existing  = remotePlayersRef.current.get(uid) || {}
  const posBuffer = existing.posBuffer || []
  posBuffer.push({ x: row.position_x, z: row.position_z, facing: row.facing })
  while (posBuffer.length > 3) posBuffer.shift()
  remotePlayersRef.current.set(uid, {
    ...existing,
    posBuffer,
    is_moving:     !!row.is_moving,
    is_in_vehicle: !!row.is_in_vehicle,
    vehicle_type:  row.vehicle_type || '',
    lastReceivedPos: { x: row.position_x, z: row.position_z },
    name:          row.name   || existing.name   || 'Player',
    outfit:        row.outfit || existing.outfit || 'casual',
    skin:          row.skin   || existing.skin   || '#F4C08A',
    voice_enabled: !!row.voice_enabled,
    x:      existing.x      ?? row.position_x,
    z:      existing.z      ?? row.position_z,
    facing: existing.facing ?? row.facing,
    lastSeen: Date.now(),
  })
  if (row.voice_enabled) voiceState.voiceEnabledSet.add(uid)
  else                   voiceState.voiceEnabledSet.delete(uid)
}

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

    // ── Last 50 global messages ───────────────────────────────────────────
    supabase
      .from('messages')
      .select('*')
      .or('type.is.null,type.eq.global')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (data) setGlobalMessages(data.reverse()) })

    // ── Global chat subscription ──────────────────────────────────────────
    const globalSub = supabase
      .channel(`global-chat-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: row }) => {
        if (row.type && row.type !== 'global') return
        setGlobalMessages(prev => [...prev.slice(-49), row])
        if (row.uid !== userId) {
          emitChatNotification('global', { fromId: row.uid, fromName: row.name, text: row.content })
        }
      })
      .subscribe()

    // ── DM notification subscription ──────────────────────────────────────
    const dmSub = supabase
      .channel(`dm-notify-${userId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `receiver_id=eq.${userId}`,
      }, ({ new: row }) => {
        if (row.type !== 'direct') return
        const existing = getDmCache(userId, row.uid)
        const alreadyCached = existing && existing.some(m => String(m.id) === String(row.id))
        if (!alreadyCached) appendDmCache(userId, row.uid, row)
        emitChatNotification('dm', { fromId: row.uid, fromName: row.name, text: row.content })
      })
      .subscribe()

    // ── Fetch currently online players ────────────────────────────────────
    const fetchOnlinePlayers = async () => {
      const cutoff = new Date(Date.now() - 30000).toISOString()
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('is_online', true)
        .gt('last_seen', cutoff)
      if (!data) return
      const newIds = []
      for (const row of data) {
        if (row.id === userId) continue   // DB PK column is "id"
        applyPlayerRow(row)
        newIds.push(row.id)
      }
      if (newIds.length > 0) {
        setRemotePlayerIds(prev => [...new Set([...prev, ...newIds])])
        setOnlinePlayers(prev => {
          const map = new Map(prev.map(p => [p.uid, p]))
          for (const id of newIds) {
            const d = remotePlayersRef.current.get(id)
            if (d && !map.has(id))
              map.set(id, { uid: id, name: d.name, outfit: d.outfit, voice_enabled: !!d.voice_enabled })
          }
          return [...map.values()]
        })
      }
    }

    // ── Fetch vehicle positions (initial) ─────────────────────────────────
    const fetchVehicles = async () => {
      const { data } = await supabase.from('vehicles').select('*')
      if (!data) return
      for (const row of data) {
        const vType = row.vehicle_id
        if (!vehicleState[vType]) continue
        vehicleState[vType].x      = row.x      ?? vehicleState[vType].x
        vehicleState[vType].z      = row.z      ?? vehicleState[vType].z
        vehicleState[vType].facing = row.facing ?? vehicleState[vType].facing
        const isStale = !row.last_seen || (Date.now() - new Date(row.last_seen).getTime() > OFFLINE_MS)
        vehicleState[vType].driverId    = isStale ? null : (row.driver_id    || null)
        vehicleState[vType].driverName  = isStale ? null : (row.driver_name  || null)
        vehicleState[vType].passengerId = isStale ? null : (row.passenger_id || null)
      }
    }

    fetchOnlinePlayers()
    fetchVehicles()

    // ── Main multiplayer channel ──────────────────────────────────────────
    const channel = supabase.channel('game-presence', {
      config: { presence: { key: userId } },
    })
    channelRef.current = channel

    // Presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const ids   = Object.keys(state).filter(id => id !== userId)
      setOnlinePlayers(
        Object.entries(state)
          .filter(([id]) => id !== userId)
          .map(([id, presences]) => ({
            uid:    id,
            name:   presences[0]?.name   || 'Player',
            outfit: presences[0]?.outfit || 'casual',
          }))
      )
      setRemotePlayerIds(prev => {
        const added   = ids.filter(id => !prev.includes(id))
        const removed = prev.filter(id => !ids.includes(id))
        if (!added.length && !removed.length) return prev
        removed.forEach(id => remotePlayersRef.current.delete(id))
        return ids
      })
    })

    // Position broadcast receiver
    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload?.uid || payload.uid === userId) return
      const existing = remotePlayersRef.current.get(payload.uid) || {}

      if (existing.x !== undefined) {
        const tdx = payload.x - existing.x
        const tdz = payload.z - existing.z
        if (tdx * tdx + tdz * tdz > 400) return   // teleport guard
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

      const voiceOn = !!payload.voice_enabled
      if (voiceOn) voiceState.voiceEnabledSet.add(payload.uid)
      else         voiceState.voiceEnabledSet.delete(payload.uid)

      remotePlayersRef.current.set(payload.uid, {
        ...existing,
        posBuffer,
        is_moving,
        is_in_vehicle:  !!payload.is_in_vehicle,
        vehicle_type:   payload.vehicle_type || '',
        lastReceivedPos: { x: payload.x, z: payload.z },
        anim:          payload.anim,
        name:          payload.name   || existing.name   || 'Player',
        outfit:        payload.outfit || existing.outfit || 'casual',
        skin:          payload.skin   || existing.skin   || '#F4C08A',
        voice_enabled:  voiceOn,
        current_emote:  payload.current_emote || '',
        x:      existing.x      ?? payload.x,
        z:      existing.z      ?? payload.z,
        facing: existing.facing ?? payload.facing,
        lastSeen: Date.now(),
      })
    })

    // Vehicle broadcast receiver
    channel.on('broadcast', { event: 'vehicle' }, ({ payload }) => {
      if (!payload?.vehicle_id || payload.driver_id === userId) return
      const vType = payload.vehicle_id
      if (!vehicleState[vType]) return
      if (payload.driver_id === null) {
        vehicleState[vType].x       = payload.x       ?? vehicleState[vType].x
        vehicleState[vType].z       = payload.z       ?? vehicleState[vType].z
        vehicleState[vType].facing  = payload.facing  ?? vehicleState[vType].facing
        vehicleState[vType].speed   = 0
        vehicleState[vType].driverId    = null; vehicleState[vType].driverName    = null
        vehicleState[vType].passengerId = null; vehicleState[vType].passengerName = null
      } else {
        vehicleState[vType].x            = payload.x        ?? vehicleState[vType].x
        vehicleState[vType].z            = payload.z        ?? vehicleState[vType].z
        vehicleState[vType].facing       = payload.facing   ?? vehicleState[vType].facing
        vehicleState[vType].speed        = payload.speed    ?? 0
        vehicleState[vType].driverId     = payload.driver_id
        vehicleState[vType].driverName   = payload.driver_name   || null
        vehicleState[vType].driverOutfit = payload.driver_outfit || 'casual'
        vehicleState[vType].driverSkin   = payload.driver_skin   || '#F4C08A'
        vehicleState[vType].passengerId      = payload.passenger_id      || null
        vehicleState[vType].passengerName    = payload.passenger_name    || null
        vehicleState[vType].passengerOutfit  = payload.passenger_outfit  || 'casual'
        vehicleState[vType].passengerSkin    = payload.passenger_skin    || '#F4C08A'
      }
    })

    // Passenger change broadcast
    channel.on('broadcast', { event: 'passenger-change' }, ({ payload }) => {
      if (!payload?.vehicle_id) return
      const vType = payload.vehicle_id
      if (!vehicleState[vType]) return
      vehicleState[vType].passengerId     = payload.passenger_id      || null
      vehicleState[vType].passengerName   = payload.passenger_name    || null
      vehicleState[vType].passengerOutfit = payload.passenger_outfit  || 'casual'
      vehicleState[vType].passengerSkin   = payload.passenger_skin    || '#F4C08A'
    })

    // ── postgres_changes: players table ──────────────────────────────────
    const playersSub = supabase
      .channel(`players-db-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, ({ eventType, new: row, old }) => {
        const uid = eventType === 'DELETE' ? old?.id : row?.id   // DB PK is "id"
        if (!uid || uid === userId) return

        if (eventType === 'DELETE' || row?.is_online === false) {
          remotePlayersRef.current.delete(uid)
          setRemotePlayerIds(prev => prev.filter(id => id !== uid))
          setOnlinePlayers(prev => prev.filter(p => p.uid !== uid))
          return
        }

        if (eventType === 'INSERT') {
          applyPlayerRow(row)
          setRemotePlayerIds(prev => prev.includes(uid) ? prev : [...prev, uid])
          setOnlinePlayers(prev =>
            prev.find(p => p.uid === uid)
              ? prev
              : [...prev, { uid, name: row.name || 'Player', outfit: row.outfit || 'casual', voice_enabled: !!row.voice_enabled }]
          )
          return
        }

        // UPDATE
        applyPlayerRow(row)
        setOnlinePlayers(prev =>
          prev.map(p => p.uid === uid
            ? { ...p, name: row.name || p.name, outfit: row.outfit || p.outfit, voice_enabled: !!row.voice_enabled }
            : p
          )
        )
      })
      .subscribe()

    channel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return

      // Initial upsert — announce ourselves to the DB (rate-limited)
      if (canUpsert()) {
        try {
          const { error } = await supabase.from('players').upsert({
            id:            userId,          // DB PK column is "id"
            name:          avatarRef.current.name,
            outfit:        avatarRef.current.outfit,
            skin:          avatarRef.current.skin,
            position_x:   minimapState.playerX,
            position_z:   minimapState.playerZ,
            facing:        minimapState.playerFacing,
            is_moving:     minimapState.isMoving,
            is_in_vehicle: !!(minimapState.drivingType || minimapState.passengerOf),
            vehicle_type:  minimapState.drivingType || minimapState.passengerOf || '',
            is_online:     true,
            last_seen:     new Date().toISOString(),
          }, { onConflict: 'id' })
          if (error) console.error('[multiplayer] initial upsert error:', error.message)
        } catch (err) {
          console.error('[multiplayer] initial upsert exception:', err)
        }
      }

      await channel.track({
        uid:    userId,
        name:   avatarRef.current.name,
        outfit: avatarRef.current.outfit,
      })

      fetchOnlinePlayers()
    })

    // ── Position broadcast every 80 ms (no DB writes here) ───────────────
    const posInterval = setInterval(() => {
      if (channelRef.current !== channel) return
      const moving      = minimapState.isMoving
      const driving     = minimapState.drivingType
      const isPassenger = !!minimapState.passengerOf

      channel.send({
        type: 'broadcast',
        event: 'pos',
        payload: {
          uid:           userId,
          x:             minimapState.playerX,
          z:             minimapState.playerZ,
          facing:        minimapState.playerFacing,
          is_moving:     moving,
          is_in_vehicle: !!(driving || isPassenger),
          vehicle_type:  driving || minimapState.passengerOf || '',
          anim:          driving ? 'driving' : (isPassenger ? 'passenger' : (moving ? 'walk' : 'idle')),
          name:          avatarRef.current.name,
          outfit:        avatarRef.current.outfit,
          skin:          avatarRef.current.skin,
          voice_enabled:  voiceState.enabled,
          current_emote:  minimapState.currentEmote || '',
        },
      })

      if (driving) {
        const vs = vehicleState[driving]
        channel.send({
          type: 'broadcast',
          event: 'vehicle',
          payload: {
            vehicle_id:       driving,
            x:                vs.x,
            z:                vs.z,
            facing:           vs.facing,
            speed:            vs.speed,
            driver_id:        userId,
            driver_name:      avatarRef.current.name,
            driver_outfit:    avatarRef.current.outfit,
            driver_skin:      avatarRef.current.skin,
            passenger_id:     vs.passengerId     || null,
            passenger_name:   vs.passengerName   || null,
            passenger_outfit: vs.passengerOutfit || 'casual',
            passenger_skin:   vs.passengerSkin   || '#F4C08A',
          },
        })
      }
    }, BROADCAST_MS)

    // ── Heartbeat: DB upsert every 3 s — minimal columns only ────────────
    const heartbeatInterval = setInterval(async () => {
      if (channelRef.current !== channel) return
      if (!canUpsert()) return   // skip if already upserted < 3 s ago

      try {
        const { error: hbErr } = await supabase.from('players').upsert({
          id:          userId,
          position_x:  minimapState.playerX,
          position_z:  minimapState.playerZ,
          facing:      minimapState.playerFacing,
          is_moving:   minimapState.isMoving,
          is_online:   true,
          last_seen:   new Date().toISOString(),
        }, { onConflict: 'id' })
        if (hbErr) console.error('[multiplayer] heartbeat upsert error:', hbErr.message)
      } catch (err) {
        console.error('[multiplayer] heartbeat exception:', err)
      }

      if (minimapState.drivingType) {
        const vType = minimapState.drivingType
        const vs    = vehicleState[vType]
        try {
          await supabase.from('vehicles').upsert({
            vehicle_id:   vType,
            x:            vs.x,
            z:            vs.z,
            facing:       vs.facing,
            driver_id:    userId,
            driver_name:  avatarRef.current.name,
            passenger_id: vs.passengerId || null,
            last_seen:    new Date().toISOString(),
          }, { onConflict: 'vehicle_id' })
        } catch {}
      }
    }, 3000)

    // ── Prune stale remote players every 5 s ─────────────────────────────
    const cleanupInterval = setInterval(() => {
      const now     = Date.now()
      let   changed = false
      remotePlayersRef.current.forEach((data, uid) => {
        if (now - data.lastSeen > OFFLINE_MS) {
          remotePlayersRef.current.delete(uid)
          changed = true
        }
      })
      if (changed) {
        setRemotePlayerIds(prev => prev.filter(id => remotePlayersRef.current.has(id)))
        for (const vType of ['car', 'bike']) {
          const vs = vehicleState[vType]
          if (vs.driverId && vs.driverId !== userId) {
            const d = remotePlayersRef.current.get(vs.driverId)
            if (!d || now - d.lastSeen > OFFLINE_MS) {
              vs.driverId = null; vs.driverName = null
              vs.passengerId = null; vs.passengerName = null
            }
          }
        }
      }
    }, 5000)

    // ── Handshake trigger ─────────────────────────────────────────────────
    channel.on('broadcast', { event: 'handshake-trigger' }, ({ payload }) => {
      if (payload?.target_uid === userId) {
        window.dispatchEvent(new CustomEvent('handshake-received', {
          detail: { initiatorUid: payload.initiator_uid },
        }))
      }
    })

    // ── Custom DOM events from PlayerController ───────────────────────────
    const onVehicleReleased = ({ detail }) => {
      const { vType, x, z, facing } = detail
      vehicleState[vType].driverId    = null; vehicleState[vType].driverName    = null
      vehicleState[vType].passengerId = null; vehicleState[vType].passengerName = null
      vehicleState[vType].x = x; vehicleState[vType].z = z; vehicleState[vType].facing = facing
      channel.send({
        type: 'broadcast', event: 'vehicle',
        payload: { vehicle_id: vType, x, z, facing, speed: 0, driver_id: null, passenger_id: null },
      })
      ;(async () => {
        try {
          const { error } = await supabase.from('vehicles').upsert({
            vehicle_id: vType, x, z, facing, driver_id: null, passenger_id: null, last_seen: new Date().toISOString(),
          }, { onConflict: 'vehicle_id' })
          if (error) console.error('[multiplayer] vehicle release error:', error.message)
        } catch (err) {
          console.error('[multiplayer] vehicle release exception:', err)
        }
      })()
    }

    const onPassengerJoin = ({ detail }) => {
      const { vType, passengerId, passengerName, passengerOutfit, passengerSkin } = detail
      vehicleState[vType].passengerId     = passengerId
      vehicleState[vType].passengerName   = passengerName
      vehicleState[vType].passengerOutfit = passengerOutfit
      vehicleState[vType].passengerSkin   = passengerSkin
      channel.send({
        type: 'broadcast', event: 'passenger-change',
        payload: { vehicle_id: vType, passenger_id: passengerId, passenger_name: passengerName, passenger_outfit: passengerOutfit, passenger_skin: passengerSkin },
      })
    }

    const onPassengerExit = ({ detail }) => {
      const { vType } = detail
      vehicleState[vType].passengerId = null; vehicleState[vType].passengerName = null
      channel.send({
        type: 'broadcast', event: 'passenger-change',
        payload: { vehicle_id: vType, passenger_id: null },
      })
    }

    const onHandshakeTrigger = ({ detail }) => {
      const { targetUid } = detail
      channel.send({
        type: 'broadcast', event: 'handshake-trigger',
        payload: { initiator_uid: userId, target_uid: targetUid },
      })
    }

    window.addEventListener('vehicle-released',   onVehicleReleased)
    window.addEventListener('passenger-join',     onPassengerJoin)
    window.addEventListener('passenger-exit',     onPassengerExit)
    window.addEventListener('handshake-trigger',  onHandshakeTrigger)

    const onUnload = () => {
      supabase.from('players').upsert({ id: userId, is_online: false }, { onConflict: 'id' })
      channel.untrack()
      supabase.removeChannel(channel)
    }
    window.addEventListener('beforeunload', onUnload)

    return () => {
      clearInterval(posInterval)
      clearInterval(heartbeatInterval)
      clearInterval(cleanupInterval)
      window.removeEventListener('beforeunload',     onUnload)
      window.removeEventListener('vehicle-released',   onVehicleReleased)
      window.removeEventListener('passenger-join',     onPassengerJoin)
      window.removeEventListener('passenger-exit',     onPassengerExit)
      window.removeEventListener('handshake-trigger',  onHandshakeTrigger)
      ;(async () => {
        try {
          await supabase.from('players').upsert({ id: userId, is_online: false }, { onConflict: 'id' })
        } catch {}
      })()
      supabase.removeChannel(channel)
      supabase.removeChannel(globalSub)
      supabase.removeChannel(dmSub)
      supabase.removeChannel(playersSub)
      channelRef.current = null
    }
  }, [userId])

  return { remotePlayerIds, onlinePlayers, globalMessages, sendGlobalMessage }
}
