export const navState = {
  target: null,   // { x, z, name } | null
  setTarget(t) { this.target = t },
  clearTarget() { this.target = null },
}
