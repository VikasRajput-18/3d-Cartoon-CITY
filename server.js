// Local dev API server — proxied by Vite on /api/*
// Mirrors the Vercel serverless functions exactly so local === production behaviour.
// Uses ES module syntax because package.json has "type":"module".

import express    from 'express'
import cors       from 'cors'
import crypto     from 'crypto'
import Razorpay   from 'razorpay'
import { createClient } from '@supabase/supabase-js'
import dotenv     from 'dotenv'

dotenv.config({ path: '.env.local' })

const app = express()
app.use(cors())
app.use(express.json())

// ── Validate required env vars at startup ─────────────────────────────────
const missing = [
  'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
].filter(k => !process.env[k])

if (missing.length) {
  console.warn(`[server] Missing env vars: ${missing.join(', ')} — payment routes will error.`)
}

// Supabase URL may be prefixed with VITE_ in .env.local (frontend key reuse)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

const rzp = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID     || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
})

const supabase = createClient(
  SUPABASE_URL                          || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const COIN_PACKS = {
  starter:  { coins: 500,   gems: 5,   price: 49,  vipDays: 0  },
  popular:  { coins: 1500,  gems: 20,  price: 99,  vipDays: 7  },
  mega:     { coins: 4000,  gems: 60,  price: 249, vipDays: 30 },
  ultimate: { coins: 10000, gems: 200, price: 499, vipDays: -1 },
}

// ── POST /api/create-order ────────────────────────────────────────────────
app.post('/api/create-order', async (req, res) => {
  try {
    const { packId, playerId } = req.body || {}
    const pack = COIN_PACKS[packId]

    if (!pack)     return res.status(400).json({ error: 'Invalid pack' })
    if (!playerId) return res.status(400).json({ error: 'Missing playerId' })

    const receipt = `${String(playerId).slice(-10)}_${Date.now()}`
    const order   = await rzp.orders.create({
      amount:   pack.price * 100,
      currency: 'INR',
      receipt,
    })

    const { error: dbErr } = await supabase.from('payments').insert({
      player_id:         playerId,
      razorpay_order_id: order.id,
      amount:            pack.price,
      pack_id:           packId,
      status:            'pending',
    })
    if (dbErr) console.warn('[create-order] payments insert:', dbErr.message)

    return res.json({
      orderId:  order.id,
      amount:   order.amount,
      currency: 'INR',
      keyId:    process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('[create-order]', err.message)
    return res.status(500).json({ error: err.message || 'Failed to create order' })
  }
})

// ── POST /api/verify-payment ──────────────────────────────────────────────
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {}

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' })
    }

    // ── 1. Verify HMAC signature — coins never granted without this ────────
    const body        = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body)
      .digest('hex')

    if (expectedSig !== razorpay_signature) {
      console.warn('[verify-payment] signature mismatch for order:', razorpay_order_id)
      return res.status(400).json({ error: 'Invalid payment signature' })
    }

    // ── 2. Fetch payment record ────────────────────────────────────────────
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle()

    if (!payment) return res.status(404).json({ error: 'Order not found' })
    if (payment.status === 'completed') return res.json({ ok: true, duplicate: true })

    const pack = COIN_PACKS[payment.pack_id]
    if (!pack) return res.status(400).json({ error: 'Unknown pack' })

    // ── 3. Mark payment completed ──────────────────────────────────────────
    await supabase
      .from('payments')
      .update({
        razorpay_payment_id,
        status:       'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('razorpay_order_id', razorpay_order_id)

    // ── 4. Load current player balance ─────────────────────────────────────
    const { data: player } = await supabase
      .from('players')
      .select('coins, gems, total_spent, vip_until')
      .eq('id', payment.player_id)
      .maybeSingle()

    // ── 5. Calculate VIP expiry ────────────────────────────────────────────
    let vipUntil = null
    if (pack.vipDays === -1) {
      vipUntil = new Date('2099-12-31T23:59:59Z').toISOString()
    } else if (pack.vipDays > 0) {
      const base = player?.vip_until && new Date(player.vip_until) > new Date()
        ? new Date(player.vip_until)
        : new Date()
      base.setDate(base.getDate() + pack.vipDays)
      vipUntil = base.toISOString()
    }

    // ── 6. Grant coins + gems ──────────────────────────────────────────────
    const updates = {
      coins:           (player?.coins       ?? 0) + pack.coins,
      gems:            (player?.gems        ?? 0) + pack.gems,
      total_spent:     (player?.total_spent ?? 0) + pack.price,
      supporter_badge: true,
    }
    if (vipUntil) updates.vip_until = vipUntil

    const { error: upsertErr } = await supabase
      .from('players')
      .upsert({ id: payment.player_id, ...updates }, { onConflict: 'id' })

    if (upsertErr) console.error('[verify-payment] player upsert:', upsertErr.message)

    return res.json({ ok: true, coins: pack.coins, gems: pack.gems, vipUntil })
  } catch (err) {
    console.error('[verify-payment]', err.message)
    return res.status(500).json({ error: err.message || 'Verification failed' })
  }
})

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`[server] API running on http://localhost:${PORT}`)
  console.log(`[server] Routes: POST /api/create-order  POST /api/verify-payment`)
})
