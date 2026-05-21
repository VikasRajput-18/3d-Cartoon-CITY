import { useState, useEffect } from 'react'
import { mobileInput } from './mobileInput'

// Returns true when the device supports touch input.
// Switches to false automatically if a hardware keyboard is detected (keyboard attached to phone/tablet).
export function useMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0,
  )

  useEffect(() => {
    mobileInput.isTouch = isMobile
  }, [isMobile])

  useEffect(() => {
    // If user presses a real keyboard key, switch to desktop mode for this session
    const onKey = () => {
      setIsMobile(false)
      mobileInput.isTouch = false
    }
    window.addEventListener('keydown', onKey, { once: true })
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return isMobile
}
