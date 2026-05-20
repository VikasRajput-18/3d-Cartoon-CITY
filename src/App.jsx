import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/store'
import Onboarding from '@/pages/Onboarding'
import Game from '@/pages/Game'

export default function App() {
  const isOnboarded = useStore(s => s.isOnboarded)
  return (
    <Routes>
      <Route path="/" element={isOnboarded ? <Game /> : <Navigate to="/start" />} />
      <Route path="/start" element={isOnboarded ? <Navigate to="/" /> : <Onboarding />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}
