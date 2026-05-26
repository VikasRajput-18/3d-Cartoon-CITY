import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/clerk-react'
import { addCoins, addGems } from '@/lib/economyState'
import COIN_PACKS from '@/lib/coinPacks'

const FONT = 'Nunito, sans-serif'
const LS_KEY = 'shop_ever_purchased'

// ── Load Razorpay checkout script on demand ────────────────────────────────
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

// ── Confetti ───────────────────────────────────────────────────────────────
function Confetti() {
  const COLORS = ['#fbbf24','#7c3aed','#ec4899','#22c55e','#38bdf8','#f97316','#a78bfa','#34d399']
  const pieces = Array.from({ length: 72 }, (_, i) => i)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, pointerEvents: 'none', overflow: 'hidden' }}>
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
              position: 'absolute',
              top: '-30px',
              left: `${(i * 1.41) % 100}%`,
              width:  size,
              height: isCircle ? size : size * 0.6,
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

// ── Floating coin animation on success ────────────────────────────────────
function FloatingCoins() {
  const coins = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
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
            position: 'absolute',
            bottom: '30%',
            left: `${20 + (i * 7) % 60}%`,
            fontSize: 22 + (i % 3) * 6,
            animation: `coin-rise ${1.2 + (i % 3) * 0.4}s ${i * 0.12}s ease-out forwards`,
          }}
        >
          🪙
        </div>
      ))}
    </div>
  )
}

// ── Single pack card ───────────────────────────────────────────────────────
function PackCard({ pack, onBuy, buying }) {
  const [hovered, setHovered] = useState(false)
  const isLoading = buying === pack.id || buying === pack.id + '_verify'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: hovered
          ? `linear-gradient(145deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))`
          : 'rgba(255,255,255,0.04)',
        border: pack.popular
          ? `2px solid ${pack.color}`
          : '1.5px solid rgba(255,255,255,0.1)',
        borderRadius: 18,
        padding: '22px 18px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'all 0.18s ease',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: pack.popular
          ? `0 0 28px ${pack.color}44, 0 8px 32px rgba(0,0,0,0.4)`
          : hovered ? '0 8px 32px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.25)',
        cursor: 'default',
      }}
    >
      {/* Popular badge */}
      {pack.popular && (
        <div style={{
          position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
          background: `linear-gradient(90deg, ${pack.color}, #a78bfa)`,
          borderRadius: 20, padding: '3px 14px',
          color: '#fff', fontSize: 11, fontWeight: 800,
          letterSpacing: '0.08em', whiteSpace: 'nowrap',
          boxShadow: `0 2px 12px ${pack.color}66`,
          fontFamily: FONT,
        }}>
          ⭐ MOST POPULAR
        </div>
      )}

      {/* Icon + name */}
      <div style={{ textAlign: 'center', paddingTop: pack.popular ? 4 : 0 }}>
        <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 6 }}>{pack.icon}</div>
        <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 15, fontFamily: FONT }}>{pack.name}</div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'center' }}>
        <span style={{
          color: pack.color, fontWeight: 900, fontSize: 28,
          fontFamily: FONT, letterSpacing: '-0.5px',
        }}>
          ₹{pack.price}
        </span>
      </div>

      {/* Perks */}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {pack.perks.map((perk, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            color: '#cbd5e1', fontSize: 12, fontFamily: FONT,
          }}>
            <span style={{ color: '#4ade80', fontSize: 11, flexShrink: 0 }}>✔</span>
            {perk}
          </li>
        ))}
      </ul>

      {/* Buy button */}
      <button
        onClick={() => !isLoading && onBuy(pack)}
        disabled={!!buying}
        style={{
          marginTop: 4,
          width: '100%',
          padding: '11px 0',
          background: buying
            ? 'rgba(255,255,255,0.08)'
            : `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)`,
          border: 'none',
          borderRadius: 12,
          color: buying ? '#64748b' : '#fff',
          fontWeight: 800,
          fontSize: 14,
          fontFamily: FONT,
          cursor: buying ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          boxShadow: buying ? 'none' : `0 4px 16px ${pack.color}55`,
          letterSpacing: '0.04em',
        }}
      >
        {isLoading ? (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Spinner /> {buying === pack.id + '_verify' ? 'Verifying…' : 'Opening…'}
          </span>
        ) : 'Buy Now'}
      </button>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 14, height: 14,
      border: '2px solid rgba(255,255,255,0.3)',
      borderTop: '2px solid #fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

// ── Success screen ─────────────────────────────────────────────────────────
function SuccessScreen({ result, onClose }) {
  return (
    <div style={{
      position: 'relative',
      background: 'linear-gradient(145deg, rgba(10,6,28,0.99), rgba(20,10,40,0.99))',
      border: '2px solid rgba(74,222,128,0.5)',
      borderRadius: 24,
      padding: '44px 36px',
      textAlign: 'center',
      maxWidth: 420,
      width: '92%',
      boxShadow: '0 0 60px rgba(74,222,128,0.2), 0 24px 64px rgba(0,0,0,0.8)',
      fontFamily: FONT,
      overflow: 'hidden',
    }}>
      <FloatingCoins />

      {/* Success icon */}
      <div style={{ fontSize: 56, marginBottom: 12, position: 'relative', zIndex: 1 }}>
        {result.pack.icon}
      </div>
      <div style={{
        color: '#4ade80', fontWeight: 900, fontSize: 24, marginBottom: 8,
        position: 'relative', zIndex: 1,
      }}>
        Payment Successful!
      </div>
      <div style={{
        color: '#e2e8f0', fontSize: 15, marginBottom: 20,
        position: 'relative', zIndex: 1,
      }}>
        You got <strong style={{ color: '#fbbf24' }}>{result.pack.coins.toLocaleString()} coins</strong>
        {' '}+<strong style={{ color: '#a78bfa' }}> {result.pack.gems} gems</strong>!
      </div>

      {/* Perks received */}
      <div style={{
        background: 'rgba(74,222,128,0.08)',
        border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        textAlign: 'left',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ color: '#86efac', fontWeight: 700, fontSize: 12, marginBottom: 10, letterSpacing: '0.08em' }}>
          WHAT YOU RECEIVED
        </div>
        {result.pack.perks.map((perk, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#cbd5e1', fontSize: 13, marginBottom: 6,
          }}>
            <span style={{ color: '#4ade80', fontSize: 12 }}>✔</span> {perk}
          </div>
        ))}
        {result.vipUntil && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: '#fbbf24', fontSize: 13, marginTop: 4,
            fontWeight: 700,
          }}>
            <span>👑</span>
            {result.vipUntil === '2099-12-31T23:59:59.000Z'
              ? 'Permanent VIP activated!'
              : `VIP active until ${new Date(result.vipUntil).toLocaleDateString()}`}
          </div>
        )}
      </div>

      {/* Wallet updated note */}
      <div style={{
        color: '#64748b', fontSize: 12, marginBottom: 20,
        position: 'relative', zIndex: 1,
      }}>
        💰 Wallet updated — coins appear in your HUD above
      </div>

      <button
        onClick={onClose}
        style={{
          width: '100%', padding: '13px 0',
          background: 'linear-gradient(135deg, #4ade80, #22c55e)',
          border: 'none', borderRadius: 14,
          color: '#052e16', fontWeight: 900, fontSize: 15,
          cursor: 'pointer', fontFamily: FONT,
          boxShadow: '0 4px 20px rgba(74,222,128,0.4)',
          position: 'relative', zIndex: 1,
        }}
      >
        🎉 Awesome!
      </button>
    </div>
  )
}

// ── Main Shop ──────────────────────────────────────────────────────────────
export default function Shop({ open, onClose }) {
  const { user } = useUser()
  const [buying,       setBuying]       = useState(null)   // packId | packId+'_verify'
  const [error,        setError]        = useState(null)
  const [success,      setSuccess]      = useState(null)   // { pack, vipUntil }
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
      // ── Step 1: Create order on server ──────────────────────────────────
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

      // ── Step 2: Load Razorpay SDK ────────────────────────────────────────
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Payment system unavailable. Check your internet connection.')

      setBuying(null)  // stop loading spinner while checkout is open

      // ── Step 3: Open Razorpay checkout ───────────────────────────────────
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
        modal: {
          ondismiss: () => {
            // User closed checkout — not an error
          },
        },
        handler: async (response) => {
          // ── Step 4: Verify on server — NEVER trust frontend ─────────────
          setBuying(pack.id + '_verify')
          try {
            const verifyRes = await fetch('/api/verify-payment', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify(response),
            })

            const verified = await verifyRes.json()

            if (!verifyRes.ok) {
              throw new Error(verified.error || 'Payment verification failed. Contact support.')
            }

            // ── Step 5: Grant coins in local state + mark first purchase ───
            addCoins(pack.coins)
            addGems(pack.gems)
            localStorage.setItem(LS_KEY, '1')

            // ── Step 6: Show success ────────────────────────────────────────
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

      {/* Backdrop */}
      <div
        onClick={e => e.target === e.currentTarget && !buying && onClose()}
        style={{
          position: 'fixed', inset: 0, zIndex: 900,
          background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONT,
        }}
      >
        {/* Success screen */}
        {success ? (
          <SuccessScreen result={success} onClose={onClose} />
        ) : (
          /* Shop panel */
          <div style={{
            background: 'linear-gradient(160deg, rgba(10,6,28,0.99) 0%, rgba(15,8,35,0.99) 100%)',
            border: '1.5px solid rgba(124,58,237,0.35)',
            borderRadius: 22,
            padding: '0 0 24px',
            width: '94%',
            maxWidth: 780,
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 0 50px rgba(124,58,237,0.2), 0 28px 80px rgba(0,0,0,0.85)',
            animation: 'shop-in 0.25s ease-out',
          }}>
            {/* Header */}
            <div style={{
              position: 'sticky', top: 0, zIndex: 2,
              background: 'rgba(10,6,28,0.97)',
              borderBottom: '1px solid rgba(124,58,237,0.2)',
              padding: '18px 24px 16px',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
              backdropFilter: 'blur(12px)',
            }}>
              <div>
                <div style={{
                  color: '#f1f5f9', fontWeight: 900, fontSize: 20,
                  fontFamily: FONT, marginBottom: 3,
                }}>
                  🛍️ Support the Developer
                </div>
                <div style={{ color: '#64748b', fontSize: 13, fontFamily: FONT }}>
                  Your purchases keep this world alive and growing
                </div>
              </div>
              <button
                onClick={() => !buying && onClose()}
                disabled={!!buying}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10, width: 34, height: 34,
                  color: '#94a3b8', fontSize: 18, cursor: buying ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: FONT, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                margin: '16px 24px 0',
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 13, fontFamily: FONT }}>
                    {error}
                  </div>
                  <button
                    onClick={() => setError(null)}
                    style={{
                      marginTop: 6, background: 'none', border: 'none',
                      color: '#ef4444', fontSize: 12, cursor: 'pointer',
                      fontFamily: FONT, padding: 0, fontWeight: 600,
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Pack grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 16,
              padding: '24px 24px 4px',
            }}>
              {COIN_PACKS.map(pack => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onBuy={handleBuy}
                  buying={buying}
                />
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px 0',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              marginTop: 8,
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <img
                src="https://razorpay.com/assets/razorpay-glyph.svg"
                alt="Razorpay"
                style={{ height: 18, opacity: 0.5 }}
                onError={e => { e.target.style.display = 'none' }}
              />
              <span style={{ color: '#475569', fontSize: 11, fontFamily: FONT }}>
                Secured by Razorpay · All major UPI, cards & net banking accepted
              </span>
              <span style={{ color: '#334155', fontSize: 11, fontFamily: FONT, marginLeft: 'auto' }}>
                Test card: 4111 1111 1111 1111 · UPI: success@razorpay
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Shop trigger button — exported for use in Game.jsx ────────────────────
export function ShopButton({ onClick }) {
  const neverPurchased = !localStorage.getItem(LS_KEY)
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Shop — buy coin packs"
      style={{
        position: 'relative',
        width: 34, height: 34, borderRadius: 10,
        background: hovered ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.15)',
        border: '1.5px solid rgba(245,158,11,0.45)',
        cursor: 'pointer', fontSize: 17,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
        boxShadow: hovered ? '0 2px 14px rgba(245,158,11,0.4)' : 'none',
      }}
    >
      🛍️
      {neverPurchased && (
        <span style={{
          position: 'absolute', top: -5, right: -5,
          width: 12, height: 12, borderRadius: '50%',
          background: '#fbbf24',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 8, color: '#1a0a00', fontWeight: 900,
          boxShadow: '0 0 6px rgba(251,191,36,0.8)',
          fontFamily: FONT,
        }}>
          ★
        </span>
      )}
    </button>
  )
}
