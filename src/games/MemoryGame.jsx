import { useState, useEffect, useRef, useCallback } from 'react'

const EMOJIS = ['🎮', '🎯', '🏆', '🎪', '🎨', '🎭']

function makeCards() {
  const pairs = [...EMOJIS, ...EMOJIS]
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]]
  }
  return pairs.map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false }))
}

export default function MemoryGame({ paused, onResult }) {
  const [cards,   setCards]   = useState(makeCards)
  const [moves,   setMoves]   = useState(0)
  const [pairs,   setPairs]   = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const lockRef      = useRef(false)
  const resultSent   = useRef(false)
  const pauseRef     = useRef(false)
  const selRef       = useRef([])   // indexes of flipped-but-unmatched cards (0 or 1 elements before second click)
  const movesRef     = useRef(0)
  const elapsedRef   = useRef(0)

  useEffect(() => { pauseRef.current = paused }, [paused])

  // Count-up timer
  useEffect(() => {
    const id = setInterval(() => {
      if (pauseRef.current || resultSent.current) return
      elapsedRef.current++
      setElapsed(t => t + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  function endGame() {
    if (resultSent.current) return
    resultSent.current = true
    const score = Math.max(0, 1000 - Math.max(0, movesRef.current - 6) * 50 - elapsedRef.current * 10)
    onResult?.(score)
  }

  const handleClick = useCallback((idx) => {
    if (lockRef.current || resultSent.current || pauseRef.current) return

    setCards(prev => {
      const card = prev[idx]
      if (card.flipped || card.matched) return prev
      if (selRef.current.includes(idx)) return prev

      const newCards = prev.map((c, i) => i === idx ? { ...c, flipped: true } : c)

      if (selRef.current.length === 0) {
        // First card selected
        selRef.current = [idx]
        return newCards
      }

      // Second card — evaluate match
      const firstIdx = selRef.current[0]
      movesRef.current++
      setMoves(m => m + 1)
      lockRef.current = true
      selRef.current = []

      if (newCards[firstIdx].emoji === newCards[idx].emoji) {
        // Match!
        setTimeout(() => {
          setCards(cc => cc.map((c, i) =>
            (i === firstIdx || i === idx) ? { ...c, matched: true, flipped: true } : c
          ))
          setPairs(p => {
            const np = p + 1
            if (np >= 6) setTimeout(endGame, 300)
            return np
          })
          lockRef.current = false
        }, 500)
      } else {
        // No match — flip both back after 1 second
        setTimeout(() => {
          setCards(cc => cc.map((c, i) =>
            (i === firstIdx || i === idx) ? { ...c, flipped: false } : c
          ))
          lockRef.current = false
        }, 1000)
      }

      return newCards
    })
  }, [])

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-4 font-body select-none">
      {/* HUD */}
      <div className="flex gap-7 text-[14px] font-bold">
        <span style={{ color: '#a78bfa' }}>🃏 {pairs}/6 pairs</span>
        <span style={{ color: '#4ade80' }}>⏱ {elapsed}s</span>
        <span style={{ color: '#facc15' }}>🎯 {moves} moves</span>
      </div>

      {/* 4×3 card grid */}
      <div
        className="grid gap-[10px]"
        style={{ gridTemplateColumns: 'repeat(4, 80px)', gridTemplateRows: 'repeat(3, 80px)' }}
      >
        {cards.map((card, idx) => (
          <div
            key={card.id}
            onClick={() => handleClick(idx)}
            className="w-20 h-20"
            style={{ perspective: '600px', cursor: card.matched ? 'default' : 'pointer' }}
          >
            <div
              className="w-full h-full relative"
              style={{
                transformStyle: 'preserve-3d',
                transform: (card.flipped || card.matched) ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transition: 'transform 0.42s ease',
              }}
            >
              {/* Back face */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-xl text-[30px]"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(59,130,246,0.2))',
                  border: '2px solid rgba(124,58,237,0.45)',
                }}
              >
                ❓
              </div>
              {/* Front face */}
              <div
                className="absolute inset-0 flex items-center justify-center rounded-xl text-[38px]"
                style={{
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  background: card.matched
                    ? 'linear-gradient(135deg, rgba(74,222,128,0.28), rgba(74,222,128,0.1))'
                    : 'linear-gradient(135deg, rgba(167,139,250,0.28), rgba(236,72,153,0.18))',
                  border: `2px solid ${card.matched ? 'rgba(74,222,128,0.65)' : 'rgba(167,139,250,0.65)'}`,
                  boxShadow: card.matched ? '0 0 12px rgba(74,222,128,0.25)' : 'none',
                }}
              >
                {card.emoji}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-slate-600 text-[12px] text-center">
        Tap cards to flip · Match all 6 pairs · Fewer moves = higher score
      </div>
    </div>
  )
}
