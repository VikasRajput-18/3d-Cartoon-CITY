import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useStore } from '@/store'
import AuthPage from '@/pages/AuthPage'
import Onboarding from '@/pages/Onboarding'
import Game from '@/pages/Game'

function Splash() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#050311',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '3px solid rgba(124,58,237,0.3)',
        borderTopColor: '#7c3aed',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function AuthenticatedApp() {
  const { user } = useUser()
  const { initForUser, isInitialized, saveForUser, isOnboarded } = useStore()
  const debounceRef = useRef(null)

  // Init store with per-user data on mount
  useEffect(() => {
    if (user) initForUser(user.id, user)
  }, [user?.id])

  // Auto-persist on any store change (debounced 1s)
  useEffect(() => {
    if (!user) return
    const unsub = useStore.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        useStore.getState().saveForUser(user.id)
      }, 1000)
    })
    return () => { unsub(); if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [user?.id])

  if (!isInitialized) return <Splash />

  return (
    <Routes>
      <Route path="/" element={isOnboarded ? <Game /> : <Navigate to="/start" />} />
      <Route path="/start" element={isOnboarded ? <Navigate to="/" /> : <Onboarding />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <Splash />
  if (!isSignedIn) return <AuthPage />

  return <AuthenticatedApp />
}
