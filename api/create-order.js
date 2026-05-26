// Server-side order creation — never expose Razorpay secret to frontend
'use strict'

const Razorpay         = require('razorpay')
const { createClient } = require('@supabase/supabase-js')

// Inline pack definitions — keeps this function self-contained, no Vite alias needed
const COIN_PACKS = [
  { id: 'starter',  price: 49  },
  { id: 'popular',  price: 99  },
  { id: 'mega',     price: 249 },
  { id: 'ultimate', price: 499 },
]

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { packId, playerId } = req.body || {}

    if (!packId || !playerId) {
      return res.status(400).json({ error: 'Missing packId or playerId' })
    }

    const pack = COIN_PACKS.find(p => p.id === packId)
    if (!pack) {
      return res.status(400).json({ error: 'Invalid pack' })
    }

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Payment system not configured' })
    }

    // Create Razorpay order
    const rzp = new Razorpay({
      key_id:     process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })

    const receipt = `${playerId.slice(-10)}_${Date.now()}`
    const order   = await rzp.orders.create({
      amount:   pack.price * 100,
      currency: 'INR',
      receipt,
    })

    // Persist pending payment — use service role to bypass RLS
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error: dbErr } = await supabase.from('payments').insert({
      player_id:          playerId,
      razorpay_order_id:  order.id,
      amount:             pack.price,
      pack_id:            packId,
      status:             'pending',
    })

    if (dbErr) {
      console.error('payments insert error:', dbErr.message)
      // Non-fatal — order is created, log and continue
    }

    return res.status(200).json({
      orderId:  order.id,
      amount:   order.amount,
      currency: 'INR',
      keyId:    process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('create-order error:', err)
    return res.status(500).json({ error: 'Failed to create order' })
  }
}
