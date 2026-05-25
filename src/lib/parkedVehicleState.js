// Parked vehicle definitions — shared between renderer and PlayerController.
// facing = rotY (same convention as player vehicle: front = +Z, atan2 facing).
// Positions match the PARKED_CARS / PARKED_BIKES arrays that WorldCanvas renders.

export const parkedVehicles = [
  // ── Cars ──────────────────────────────────────────────────────────────────
  { id:'pv0',  type:'car',  x:-10, z:-21, facing: Math.PI/2,  color:'#3b82f6', driverId:null },
  { id:'pv1',  type:'car',  x: 10, z:-21, facing:-Math.PI/2,  color:'#f8fafc', driverId:null },
  { id:'pv2',  type:'car',  x: 22, z:-21, facing: Math.PI/2,  color:'#facc15', driverId:null },
  { id:'pv3',  type:'car',  x: 23, z:-10, facing: 0,          color:'#64748b', driverId:null },
  { id:'pv4',  type:'car',  x: 23, z: 12, facing: Math.PI,    color:'#ef4444', driverId:null },
  { id:'pv5',  type:'car',  x:-23, z:-10, facing: 0,          color:'#16a34a', driverId:null },
  { id:'pv6',  type:'car',  x:-23, z: 12, facing: Math.PI,    color:'#f97316', driverId:null },
  { id:'pv7',  type:'car',  x: 10, z: 21, facing:-Math.PI/2,  color:'#8b5cf6', driverId:null },
  // ── Bikes ─────────────────────────────────────────────────────────────────
  { id:'pv8',  type:'bike', x: -8, z:-21, facing: Math.PI/2,  color:'#a855f7', driverId:null },
  { id:'pv9',  type:'bike', x: -8, z: 21, facing:-Math.PI/2,  color:'#ec4899', driverId:null },
  { id:'pv10', type:'bike', x: 23, z:  3, facing: 0,          color:'#34d399', driverId:null },
  { id:'pv11', type:'bike', x:-23, z:  5, facing: Math.PI,    color:'#f59e0b', driverId:null },
]

const _listeners = new Set()

export function onParkedVehicleChange(fn) {
  _listeners.add(fn)
  return () => _listeners.delete(fn)
}

export function notifyParkedVehicleChange() {
  _listeners.forEach(fn => fn())
}
