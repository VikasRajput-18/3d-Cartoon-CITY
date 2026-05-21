// Shared mutable state written by MobileControls, read by PlayerController every frame.
export const mobileInput = {
  joyX:     0,      // -1 to 1 (left/right)
  joyY:     0,      // -1 to 1 (negative = forward/up)
  joyActive: false,
  isTouch:   false, // set true when MobileControls mounts
}
