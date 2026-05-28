import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useUser } from '@clerk/clerk-react'
import { addCoins, addGems } from '@/lib/economyState'
import COIN_PACKS from '@/lib/coinPacks'

const LS_KEY = 'shop_ever_purchased'

function loadRazorpay() {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function Confetti() {
  const COLORS = ['#fbbf24','#7c3aed','#ec4899','#22c55e','#38bdf8','#f97316','#a78bfa','#34d399']
  const pieces = Array.from({ length: 72 }, (_, i) => i)
  return (
    <div className="fixed inset-0 z-[1100] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes conf-fall {
          0%   { transform: translateY(-30px) rotate(0deg) scale(1);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(105vh) rotate(800deg) scale(0.6); opacity: 0; }
        }
        @keyframes conf-sway {
          0%,100% { margin-left: 0; }
          50%     { margin-left: 28px; }
        }
      `}</style>
      {pieces.map(i => {
        const isCircle = i % 3 === 0
        const size = 7 + (i % 5) * 2
        return (
          <div
            key={i}
            style={{
              position: 'absolute', top: '-30px',
              left: `${(i * 1.41) % 100}%`,
              width: size, height: isCircle ? size : size * 0.6,
              backgroundColor: COLORS[i % COLORS.length],
              borderRadius: isCircle ? '50%' : 2,
              animation: `conf-fall ${2 + (i % 4) * 0.5}s ${(i * 0.038) % 2.2}s linear forwards,
                          conf-sway ${1.2 + (i % 3) * 0.4}s ${(i * 0.025) % 1.5}s ease-in-out infinite`,
            }}
          />
        )
      })}
    </div>
  )
}

function FloatingCoins() {
  const coins = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <style>{`
        @keyframes coin-rise {
          0%   { transform: translateY(0) scale(0.5); opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: translateY(-120px) scale(1.2); opacity: 0; }
        }
      `}</style>
      {coins.map(i => (
        <div
          key={i}
          style={{
            position: 'absolute', bottom: '30%',
            left: `${20 + (i * 7) % 60}%`,
            fontSize: 22 + (i % 3) * 6,
            animation: `coin-rise ${1.2 + (i % 3) * 0.4}s ${i * 0.12}s ease-out forwards`,
          }}
        >🪙</div>
      ))}
    </div>
  )
}

function PackCard({ pack, onBuy, buying }) {
  const [hovered, setHovered] = useState(false)
  const isLoading = buying === pack.id || buying === pack.id + '_verify'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col gap-[10px]"
      style={{
        background: hovered
          ? 'linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))'
          : 'rgba(255,255,255,0.04)',
        border: pack.popular ? `2px solid ${pack.color}` : '1.5px solid rgba(255,255,255,0.1)',
        borderRadius: 18,
        padding: '22px 18px 18px',
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: pack.popular
          ? `0 0 28px ${pack.color}44, 0 8px 32px rgba(0,0,0,0.4)`
          : hovered ? '0 8px 32px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.25)',
        cursor: 'default',
      }}
    >
      {pack.popular && (
        <div
          className="absolute font-body text-white font-extrabold text-[11px] tracking-[0.08em] whitespace-nowrap"
          style={{
            top: -13, left: '50%', transform: 'translateX(-50%)',
            background: `linear-gradient(90deg, ${pack.color}, #a78bfa)`,
            borderRadius: 20, padding: '3px 14px',
            boxShadow: `0 2px 12px ${pack.color}66`,
          }}
        >
          ⭐ MOST POPULAR
        </div>
      )}

      <div className={`text-center ${pack.popular ? 'pt-1' : ''}`}>
        <div className="text-[38px] leading-none mb-[6px]">{pack.icon}</div>
        <div className="text-slate-100 font-extrabold text-[15px] font-body">{pack.name}</div>
      </div>

      <div className="text-center">
        <span className="font-black text-[28px] font-body" style={{ color: pack.color, letterSpacing: '-0.5px' }}>
          ₹{pack.price}
        </span>
      </div>

      <ul className="list-none m-0 p-0 flex flex-col gap-[5px]">
        {pack.perks.map((perk, i) => (
          <li key={i} className="flex items-center gap-[7px] text-slate-300 text-[12px] font-body">
            <span className="text-green-400 text-[11px] shrink-0">✔</span>
            {perk}
          </li>
        ))}
      </ul>

      <button
        onClick={() => !isLoading && onBuy(pack)}
        disabled={!!buying}
        className="w-full mt-1 border-0 font-body"
        style={{
          padding: '11px 0',
          background: buying ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)`,
          borderRadius: 12,
          color: buying ? '#64748b' : '#fff',
          fontWeight: 800, fontSize: 14,
          cursor: buying ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          boxShadow: buying ? 'none' : `0 4px 16px ${pack.color}55`,
          letterSpacing: '0.04em',
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> {buying === pack.id + '_verify' ? 'Verifying…' : 'Opening…'}
          </span>
        ) : 'Buy Now'}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block w-[14px] h-[14px] rounded-full"
      style={{
        border: '2px solid rgba(255,255,255,0.3)',
        borderTop: '2px solid #fff',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  )
}

function SuccessScreen({ result, onClose }) {
  return (
    <div
      className="relative rounded-3xl text-center max-w-[420px] w-[92%] overflow-hidden font-body"
      style={{
        background: 'linear-gradient(145deg, rgba(10,6,28,0.99), rgba(20,10,40,0.99))',
        border: '2px solid rgba(74,222,128,0.5)',
        padding: '44px 36px',
        boxShadow: '0 0 60px rgba(74,222,128,0.2), 0 24px 64px rgba(0,0,0,0.8)',
      }}
    >
      <FloatingCoins />
      <div className="text-[56px] mb-3 relative z-[1]">{result.pack.icon}</div>
      <div className="text-green-400 font-black text-2xl mb-2 relative z-[1]">Payment Successful!</div>
      <div className="text-slate-200 text-[15px] mb-5 relative z-[1]">
        You got <strong style={{ color: '#fbbf24' }}>{result.pack.coins.toLocaleString()} coins</strong>
        {' '}+<strong style={{ color: '#a78bfa' }}> {result.pack.gems} gems</strong>!
      </div>

      <div
        className="rounded-[14px] text-left relative z-[1] mb-6"
        style={{
          background: 'rgba(74,222,128,0.08)',
          border: '1px solid rgba(74,222,128,0.2)',
          padding: '16px 20px',
        }}
      >
        <div className="text-green-300 font-bold text-[12px] mb-[10px] tracking-[0.08em]">
          WHAT YOU RECEIVED
        </div>
        {result.pack.perks.map((perk, i) => (
          <div key={i} className="flex items-center gap-2 text-slate-300 text-[13px] mb-[6px]">
            <span className="text-green-400 text-[12px]">✔</span> {perk}
          </div>
        ))}
        {result.vipUntil && (
          <div className="flex items-center gap-2 text-yellow-400 text-[13px] mt-1 font-bold">
            <span>👑</span>
            {result.vipUntil === '2099-12-31T23:59:59.000Z'
              ? 'Permanent VIP activated!'
              : `VIP active until ${new Date(result.vipUntil).toLocaleDateString()}`}
          </div>
        )}
      </div>

      <div className="text-slate-500 text-[12px] mb-5 relative z-[1]">
        💰 Wallet updated — coins appear in your HUD above
      </div>

      <button
        onClick={onClose}
        className="w-full border-0 font-black text-[15px] cursor-pointer rounded-[14px] relative z-[1] font-body"
        style={{
          padding: '13px 0',
          background: 'linear-gradient(135deg, #4ade80, #22c55e)',
          color: '#052e16',
          boxShadow: '0 4px 20px rgba(74,222,128,0.4)',
        }}
      >
        🎉 Awesome!
      </button>
    </div>
  )
}

export default function Shop({ open, onClose }) {
  const { user } = useUser()
  const [buying,       setBuying]       = useState(null)
  const [error,        setError]        = useState(null)
  const [success,      setSuccess]      = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const confettiTimer = useRef(null)

  useEffect(() => {
    if (!open) {
      setError(null)
      setSuccess(null)
      setShowConfetti(false)
      if (confettiTimer.current) clearTimeout(confettiTimer.current)
    }
  }, [open])

  const handleBuy = useCallback(async (pack) => {
    setError(null)
    setBuying(pack.id)
    try {
      const orderRes = await fetch('/api/create-order', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ packId: pack.id, playerId: user?.id }),
      })
      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to create order. Please try again.')
      }
      const orderData = await orderRes.json()

      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Payment system unavailable. Check your internet connection.')

      setBuying(null)

      const options = {
        key:      import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount:   orderData.amount,
        currency: orderData.currency,
        order_id: orderData.orderId,
        name:     'Cartoon Life Universe',
        description: pack.name,
        prefill: {
          name:  user?.fullName || user?.firstName || '',
          email: user?.emailAddresses?.[0]?.emailAddress || '',
        },
        theme: { color: '#7C3AED' },
        modal: { ondismiss: () => {} },
        handler: async (response) => {
          setBuying(pack.id + '_verify')
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(response),
            })
            const verified = await verifyRes.json()
            if (!verifyRes.ok) throw new Error(verified.error || 'Payment verification failed. Contact support.')
            addCoins(pack.coins)
            addGems(pack.gems)
            localStorage.setItem(LS_KEY, '1')
            setSuccess({ pack, vipUntil: verified.vipUntil })
            setShowConfetti(true)
            confettiTimer.current = setTimeout(() => setShowConfetti(false), 5500)
          } catch (err) {
            console.error('verify-payment error:', err)
            setError(err.message || 'Payment verification failed. Your payment was received — contact support if coins are missing.')
          } finally {
            setBuying(null)
          }
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', ({ error: e }) => {
        setError(e?.description || 'Payment failed. Please try a different payment method.')
      })
      rzp.open()
    } catch (err) {
      console.error('handleBuy error:', err)
      setBuying(null)
      setError(err.message || 'Something went wrong. Please try again.')
    }
  }, [user])

  if (!open) return null

  return (
    <>
      {showConfetti && <Confetti />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shop-in {
          from { opacity: 0; transform: scale(0.94) translateY(16px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      <div
        onClick={e => e.target === e.currentTarget && !buying && onClose()}
        className="fixed inset-0 z-[900] flex items-center justify-center font-body backdrop-blur-[10px]"
        style={{ background: 'rgba(0,0,0,0.78)' }}
      >
        {success ? (
          <SuccessScreen result={success} onClose={onClose} />
        ) : (
          <div
            className="w-[94%] max-w-[780px] max-h-[90vh] overflow-y-auto rounded-[22px]"
            style={{
              background: 'linear-gradient(160deg, rgba(10,6,28,0.99) 0%, rgba(15,8,35,0.99) 100%)',
              border: '1.5px solid rgba(124,58,237,0.35)',
              padding: '0 0 24px',
              boxShadow: '0 0 50px rgba(124,58,237,0.2), 0 28px 80px rgba(0,0,0,0.85)',
              animation: 'shop-in 0.25s ease-out',
            }}
          >
            <div
              className="sticky top-0 z-[2] flex items-start justify-between backdrop-blur-[12px]"
              style={{
                background: 'rgba(10,6,28,0.97)',
                borderBottom: '1px solid rgba(124,58,237,0.2)',
                padding: '18px 24px 16px',
              }}
            >
              <div>
                <div className="text-slate-100 font-black text-xl mb-[3px] font-body">
                  🛍️ Support the Developer
                </div>
                <div className="text-slate-500 text-[13px] font-body">
                  Your purchases keep this world alive and growing
                </div>
              </div>
              <button
                onClick={() => !buying && onClose()}
                disabled={!!buying}
                className={`flex items-center justify-center w-[34px] h-[34px] rounded-[10px] text-lg text-slate-400 shrink-0 font-body ${buying ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >×</button>
            </div>

            {error && (
              <div
                className="mx-6 mt-4 flex items-start gap-[10px] rounded-xl"
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  padding: '12px 16px',
                }}
              >
                <span className="text-lg shrink-0">⚠️</span>
                <div>
                  <div className="text-red-300 font-bold text-[13px] font-body">{error}</div>
                  <button
                    onClick={() => setError(null)}
                    className="mt-[6px] bg-transparent border-0 text-red-500 text-xs cursor-pointer font-body p-0 font-semibold"
                  >Dismiss</button>
                </div>
              </div>
            )}

            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                padding: '24px 24px 4px',
              }}
            >
              {COIN_PACKS.map(pack => (
                <PackCard key={pack.id} pack={pack} onBuy={handleBuy} buying={buying} />
              ))}
            </div>

            <div
              className="flex flex-col gap-[10px] mt-2"
              style={{ padding: '16px 24px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <img
                  src="https://razorpay.com/assets/razorpay-glyph.svg"
                  alt="Razorpay"
                  className="h-[18px] opacity-50"
                  onError={e => { e.target.style.display = 'none' }}
                />
                <span className="text-slate-600 text-[11px] font-body">
                  Secured by Razorpay · All major UPI, cards &amp; net banking accepted
                </span>
                <span className="text-slate-700 text-[11px] font-body ml-auto">
                  Test card: 5267 3181 8797 5449 · UPI: success@razorpay
                </span>
              </div>
              <div className="text-slate-700 text-[11px] font-body">
                By purchasing you agree to our{' '}
                <Link to="/terms-and-conditions" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">
                  Terms &amp; Conditions
                </Link>
                {' '}and{' '}
                <Link to="/privacy-policy" className="text-slate-500 hover:text-violet-400 transition-colors no-underline">
                  Privacy Policy
                </Link>
                . All purchases are final.
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export function ShopButton({ onClick }) {
  const neverPurchased = !localStorage.getItem(LS_KEY)

  return (
    <button
      onClick={onClick}
      title="Shop — buy coin packs"
      className="relative w-[34px] h-[34px] rounded-[10px] cursor-pointer text-[17px] flex items-center justify-center transition-all duration-150 bg-[rgba(245,158,11,0.15)] hover:bg-[rgba(245,158,11,0.25)] hover:shadow-[0_2px_14px_rgba(245,158,11,0.4)]"
      style={{ border: '1.5px solid rgba(245,158,11,0.45)' }}
    >
      🛍️
      {neverPurchased && (
        <span
          className="absolute -top-[5px] -right-[5px] w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-black font-body"
          style={{ background: '#fbbf24', color: '#1a0a00', boxShadow: '0 0 6px rgba(251,191,36,0.8)' }}
        >★</span>
      )}
    </button>
  )
}
