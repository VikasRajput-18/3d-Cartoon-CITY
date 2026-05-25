// Shared mutable state for voice chat — no React, no overhead.
// Written by useVoiceChat, read by RemotePlayer useFrame.

function loadMuted() {
  try {
    const raw = localStorage.getItem('clu3d_muted')
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

export function saveMuted() {
  try {
    localStorage.setItem('clu3d_muted', JSON.stringify([...voiceState.mutedSet]))
  } catch {}
}

export const voiceState = {
  enabled:         false,
  pttMode:         false,
  pttActive:       false,
  localSpeaking:   false,
  speakingSet:     new Set(),
  mutedSet:        loadMuted(),   // persisted in localStorage
  voiceEnabledSet: new Set(),
}
