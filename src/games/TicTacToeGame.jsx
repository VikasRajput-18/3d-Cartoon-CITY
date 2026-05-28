import { useState, useRef } from 'react'

const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWinner(b) {
  for (const [a,c,d] of WINS) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
  if (b.every(Boolean)) return 'draw'
  return null
}

function minimax(b, isMax, depth) {
  const w = checkWinner(b)
  if (w === 'O') return 10 - depth
  if (w === 'X') return depth - 10
  if (w === 'draw') return 0
  let best = isMax ? -Infinity : Infinity
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue
    b[i] = isMax ? 'O' : 'X'
    const val = minimax(b, !isMax, depth + 1)
    b[i] = null
    best = isMax ? Math.max(best, val) : Math.min(best, val)
  }
  return best
}

function getBestMove(b, diff) {
  const empty = b.map((v, i) => (!v ? i : -1)).filter(i => i >= 0)
  if (!empty.length) return undefined
  if (diff === 'easy') return empty[Math.floor(Math.random() * empty.length)]
  if (diff === 'medium' && Math.random() < 0.45) return empty[Math.floor(Math.random() * empty.length)]
  let best = -Infinity, move = empty[0]
  for (const i of empty) {
    const nb = [...b]; nb[i] = 'O'
    const val = minimax(nb, false, 0)
    if (val > best) { best = val; move = i }
  }
  return move
}

export default function TicTacToeGame({ paused, onResult }) {
  const [board,      setBoard]      = useState(Array(9).fill(null))
  const [diff,       setDiff]       = useState(null)
  const [round,      setRound]      = useState(1)
  const [xScore,     setXScore]     = useState(0)
  const [oWins,      setOWins]      = useState(0)
  const [msg,        setMsg]        = useState('')
  const [aiThinking, setAiThinking] = useState(false)

  // Refs hold authoritative mutable state so no stale-closure bugs
  const gRef = useRef({ xScore: 0, round: 1, ended: false })

  function finishGame(addNow) {
    if (gRef.current.ended) return
    gRef.current.ended = true
    const final = gRef.current.xScore + addNow
    setTimeout(() => onResult?.(final), 1200)
  }

  function advanceRound(addNow) {
    gRef.current.xScore += addNow
    gRef.current.round++
    setXScore(gRef.current.xScore)
    setTimeout(() => {
      setBoard(Array(9).fill(null))
      setRound(gRef.current.round)
      setMsg('')
      setAiThinking(false)
    }, 1200)
  }

  function handleRoundOutcome(w, addNow) {
    if (gRef.current.round >= 3) finishGame(addNow)
    else advanceRound(addNow)
  }

  function aiMove(b, d) {
    if (!b.some(v => !v)) return
    setAiThinking(true)
    setTimeout(() => {
      if (gRef.current.ended) return
      const idx = getBestMove(b, d)
      if (idx === undefined || idx === null) { setAiThinking(false); return }
      const nb = [...b]; nb[idx] = 'O'
      const w = checkWinner(nb)
      setBoard(nb)
      setAiThinking(false)
      if (w === 'O') {
        setMsg('AI wins this round!')
        setOWins(s => s + 1)
        handleRoundOutcome(w, 0)
      } else if (w === 'draw') {
        setMsg("Draw! +5 pts")
        handleRoundOutcome(w, 5)
      }
    }, 380)
  }

  function handleClick(i) {
    if (!diff || board[i] || paused || msg || aiThinking || gRef.current.ended) return
    const nb = [...board]; nb[i] = 'X'
    const w  = checkWinner(nb)
    setBoard(nb)
    if (w === 'X') {
      setMsg('You win this round! +10 pts')
      handleRoundOutcome(w, 10)
    } else if (w === 'draw') {
      setMsg("Draw! +5 pts")
      handleRoundOutcome(w, 5)
    } else {
      aiMove(nb, diff)
    }
  }

  if (!diff) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-4 font-body">
        <div className="text-[40px]">⭕</div>
        <div className="text-violet-400 text-[22px] font-extrabold">Tic Tac Toe</div>
        <div className="text-slate-500 text-[13px] mb-2">Best of 3 rounds · You are X</div>
        {['easy', 'medium', 'hard'].map(d => (
          <button
            key={d}
            onClick={() => setDiff(d)}
            className="w-[180px] py-[13px] rounded-xl text-white text-[16px] font-bold cursor-pointer border-0 font-body"
            style={{ background: d === 'easy' ? '#16a34a' : d === 'medium' ? '#d97706' : '#dc2626' }}
          >
            {d === 'easy' ? '😊 Easy' : d === 'medium' ? '🤔 Medium' : '🤖 Hard (AI)'}
          </button>
        ))}
      </div>
    )
  }

  const cellCls = (i) =>
    `w-[88px] h-[88px] flex items-center justify-center text-[38px] font-extrabold rounded-xl select-none transition-[background] duration-150`

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-3 font-body">
      <div className="flex gap-6 text-slate-200 text-[14px] font-bold">
        <span style={{ color: '#a78bfa' }}>You (X): {xScore} pts</span>
        <span className="text-slate-400">Round {round}/3</span>
        <span style={{ color: '#f87171' }}>AI (O): {oWins}W</span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 88px)' }}>
        {board.map((cell, i) => (
          <div
            key={i}
            className={cellCls(i)}
            onClick={() => handleClick(i)}
            style={{
              cursor: (board[i] || msg || aiThinking) ? 'default' : 'pointer',
              background: board[i] ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.04)',
              border: '2px solid rgba(124,58,237,0.25)',
              color: board[i] === 'X' ? '#a78bfa' : '#f87171',
            }}
          >{cell}</div>
        ))}
      </div>

      {msg && (
        <div
          className="text-[16px] font-bold"
          style={{ color: msg.includes('win') ? '#4ade80' : msg.includes('Draw') ? '#facc15' : '#f87171' }}
        >
          {msg}
        </div>
      )}
      {aiThinking && !msg && (
        <div className="text-slate-600 text-[13px]">AI is thinking…</div>
      )}
      <div className="text-slate-500 text-[12px]">Tap a cell to play</div>
    </div>
  )
}
