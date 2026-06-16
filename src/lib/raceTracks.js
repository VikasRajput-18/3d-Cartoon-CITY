// Race track registry. The confusing city-street routes were replaced with ONE
// dedicated closed-loop circuit (see raceCircuit.js for the geometry). The track
// checkpoints come straight from the circuit's gate positions, so the race logic,
// the 3D renderer, and the minimap all share a single source of truth.
import { CHECKPOINTS } from './raceCircuit'

export const RACE_TRACKS = [
  {
    id: 'speedway',
    name: 'City Speedway',
    difficulty: 'medium',
    laps: 2,
    // Gate world positions around the loop. checkpoints[0] is the start/finish line.
    checkpoints: CHECKPOINTS.map(c => ({ x: c.x, z: c.z })),
  },
]

export function getTrack(id) {
  return RACE_TRACKS.find(t => t.id === id) ?? null
}

export const COIN_REWARD_BASE    = { easy: 30, medium: 60, hard: 100 }
export const RECORD_BONUS        = 50
export const PERSONAL_BEST_BONUS  = 20
// Generous trigger radius — covers the full track width so a gate can't be missed
// while you're on the circuit.
export const CHECKPOINT_RADIUS   = 12
