// Parked vehicle definitions — shared between renderer and PlayerController.
// facing = rotY (same convention as player vehicle: front = +Z, atan2 facing).
// Positions match the PARKED_CARS / PARKED_BIKES arrays that WorldCanvas renders.

// A small, well-spaced set of city vehicles. Every entry is ≥30 units from any
// other vehicle (and from the shared car at (8,20) / shared bike at (-18,6)), so
// no two vehicles ever visually overlap or read as a "duplicate".
export const parkedVehicles = [
  { id:'pv0', type:'car',  x:-40, z:-21, facing: Math.PI/2, color:'#3b82f6', driverId:null },
  { id:'pv1', type:'car',  x: 40, z:-10, facing: 0,         color:'#ef4444', driverId:null },
  { id:'pv2', type:'car',  x:-23, z: 40, facing: Math.PI,   color:'#f97316', driverId:null },
  { id:'pv3', type:'bike', x: 40, z: 21, facing:-Math.PI/2, color:'#34d399', driverId:null },
  { id:'pv4', type:'bike', x:-40, z: 12, facing: 0,         color:'#a855f7', driverId:null },

  // ── Race cars parked on the starting grid of the City Speedway (north) ──────
  // The player's grid slot is at the BACK of the grid (x ≈ -18 on the bottom
  // straight, START ≈ (0,335)); the AI racers (raceState.js) line up ahead, so
  // you start last and chase the pack. Both face +x (the travel direction).
  { id:'race-car-1',  type:'car',  x:-18, z:332, facing: Math.PI/2, color:'#ef4444', driverId:null },
  { id:'race-bike-1', type:'bike', x:-18, z:338, facing: Math.PI/2, color:'#22d3ee', driverId:null },
]

// Live registry of the actual three.js refs for each parked vehicle, keyed by
// vehicle id. Each entry = { group, wheels, dusts, lean, bdust } (all React refs).
// Populated by the ParkedVehicles renderer on mount. The driving loop looks up
// the entered vehicle here and moves THIS SAME mesh — there is no second "driven"
// mesh, so a parked vehicle can never visually duplicate itself.
export const parkedVehicleMeshes = {}

const _listeners = new Set()

export function onParkedVehicleChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function notifyParkedVehicleChange() {
  _listeners.forEach(fn => fn())
}
