// Server-side payment verification — coins are NEVER granted without valid signature
'use strict'

const crypto           = require('crypto')
const { createClient } = require('@supabase/supabase-js')

// Full pack definitions needed for coin/gem grants
const COIN_PACKS = [
  { id: 'starter',  coins: 500,   gems: 5,   price: 49,  vipDays: 0 },
  { id: 'popular',  coins: 1500,  gems: 20,  price: 99,  vipDays: 7 },
  { id: 'mega',     coins: 4000,  gems: 60,  price: 249, vipDays: 30 },
  { id: 'ultimate', coins: 10000, gems: 200, price: 499, vipDays: -1 }, // -1 = permanent
]

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // ── Initialize Supabase inside the handler (Vercel serverless env safety) ──
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('Supabase URL:', supabaseUrl)
  console.log('Service key exists:', !!supabaseKey)
  console.log('Razorpay secret exists:', !!process.env.RAZORPAY_KEY_SECRET)

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables: supabaseUrl=' + supabaseUrl + ' keyExists=' + !!supabaseKey })
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Missing Razorpay credentials' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {}

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' })
    }

    // ── 1. Verify Razorpay HMAC signature ────────────────────────────────────
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.warn('Signature mismatch for order:', razorpay_order_id)
      return res.status(400).json({ error: 'Invalid payment signature' })
    }

    // ── 2. Look up the pending payment record ─────────────────────────────────
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (fetchErr || !payment) {
      console.error('Payment record not found:', razorpay_order_id)
      return res.status(404).json({ error: 'Payment record not found' })
    }

    // ── 3. Idempotency — reject duplicate completions ─────────────────────────
    if (payment.status === 'completed') {
      return res.status(200).json({ ok: true, duplicate: true })
    }

    // ── 4. Find pack config ───────────────────────────────────────────────────
    const pack = COIN_PACKS.find(p => p.id === payment.pack_id)
    if (!pack) {
      return res.status(400).json({ error: 'Unknown pack' })
    }

    // ── 5. Mark payment completed ─────────────────────────────────────────────
    await supabase
      .from('payments')
      .update({
        razorpay_payment_id,
        status:       'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id)

    // ── 6. Load current player balance ────────────────────────────────────────
    const { data: player } = await supabase
      .from('players')
      .select('coins, gems, total_spent, vip_until')
      .eq('id', payment.player_id)
      .maybeSingle()

    const currentCoins = player?.coins ?? 0
    const currentGems  = player?.gems  ?? 0
    const currentSpent = player?.total_spent ?? 0

    // ── 7. Calculate VIP expiry ───────────────────────────────────────────────
    let vipUntil = null
    if (pack.vipDays === -1) {
      // Permanent — set far future date
      vipUntil = new Date('2099-12-31T23:59:59Z').toISOString()
    } else if (pack.vipDays > 0) {
      // Stack on top of existing VIP if still active
      const base = player?.vip_until && new Date(player.vip_until) > new Date()
        ? new Date(player.vip_until)
        : new Date()
      base.setDate(base.getDate() + pack.vipDays)
      vipUntil = base.toISOString()
    }

    // ── 8. Grant coins + gems to player ──────────────────────────────────────
    const updates = {
      id:              payment.player_id,
      coins:           currentCoins + pack.coins,
      gems:            currentGems  + pack.gems,
      total_spent:     currentSpent + pack.price,
      supporter_badge: true,
    }
    if (vipUntil) updates.vip_until = vipUntil

    const { error: upsertErr } = await supabase
      .from('players')
      .upsert(updates, { onConflict: 'id' })

    if (upsertErr) {
      console.error('Player upsert error:', upsertErr.message)
      // Payment is recorded — don't fail the response, coins will sync on next login
    }

    return res.status(200).json({
      ok:       true,
      coins:    pack.coins,
      gems:     pack.gems,
      vipUntil,
    })
  } catch (err) {
    console.error('verify-payment error:', err)
    return res.status(500).json({ error: 'Verification failed' })
  }
}
