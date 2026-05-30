import { useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import { useStore } from '@/store'
import AuthPage from '@/pages/AuthPage'
import Onboarding from '@/pages/Onboarding'
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import TermsAndConditions from '@/pages/TermsAndConditions'
import AboutUs from '@/pages/AboutUs'

const Game           = lazy(() => import('@/pages/Game'))
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'))

function Splash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050311]">
      <div
        className="w-12 h-12 rounded-full"
        style={{
          border: '3px solid rgba(124,58,237,0.3)',
          borderTopColor: '#7c3aed',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-7 bg-[#050311] font-body">
      <div className="text-[56px] leading-none">🌍</div>
      <div className="text-white text-[22px] font-extrabold tracking-[1px]">
        Cartoon Life Universe
      </div>
      <div
        className="w-[220px] h-[6px] rounded-full overflow-hidden"
        style={{ background: 'rgba(124,58,237,0.25)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            animation: 'bar 1.6s ease-in-out infinite',
          }}
        />
      </div>
      <div className="text-violet-400 text-[13px] font-semibold">Loading world…</div>
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
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <Splash />

  return (
    <Routes>
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
      <Route path="/about-us" element={<AboutUs />} />
      <Route path="/*" element={isSignedIn ? <AuthenticatedApp /> : <AuthPage />} />
    </Routes>
  )
}
