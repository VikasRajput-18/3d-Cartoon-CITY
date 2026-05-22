// Module-level state for remote players — written by useMultiplayer, read by RemotePlayer each frame
// uid → { x, z, facing, posBuffer, is_moving, is_in_vehicle, vehicle_type, name, outfit, skin, lastSeen }
export const remotePlayersRef = { current: new Map() }
