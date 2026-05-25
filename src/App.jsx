import { useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useStore } from '@/store'
import AuthPage from '@/pages/AuthPage'
import Onboarding from '@/pages/Onboarding'

const Game = lazy(() => import('@/pages/Game'))

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

function LoadingScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28,
      background: '#050311', fontFamily: 'Nunito, sans-serif',
    }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>🌍</div>
      <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>
        Cartoon Life Universe
      </div>
      <div style={{ width: 220, height: 6, borderRadius: 99, background: 'rgba(124,58,237,0.25)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          animation: 'bar 1.6s ease-in-out infinite',
        }} />
      </div>
      <div style={{ color: '#a78bfa', fontSize: 13, fontWeight: 600 }}>Loading world…</div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes bar  { 0%{width:0%} 60%{width:90%} 100%{width:100%} }
      `}</style>
    </div>
  )
}

function AuthenticatedApp() {
  const { user } = useUser()
  const { initForUser, isInitialized, saveForUser, isOnboarded } = useStore()
  const debounceRef = useRef(null)

  useEffect(() => {
    if (user) initForUser(user.id, user)
  }, [user?.id])

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
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={isOnboarded ? <Game /> : <Navigate to="/start" />} />
        <Route path="/start" element={isOnboarded ? <Navigate to="/" /> : <Onboarding />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <Splash />
  if (!isSignedIn) return <AuthPage />

  return <AuthenticatedApp />
}
