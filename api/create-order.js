const Razorpay = require('razorpay')
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  console.log('Supabase URL:', supabaseUrl)
  console.log('Service key exists:', !!supabaseKey)
  console.log('Razorpay key exists:', !!process.env.RAZORPAY_KEY_ID)

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing environment variables: supabaseUrl=' + supabaseUrl + ' keyExists=' + !!supabaseKey })
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Missing Razorpay credentials' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })

  const COIN_PACKS = {
    starter:  { coins: 500,   gems: 5,   price: 49  },
    popular:  { coins: 1500,  gems: 20,  price: 99  },
    mega:     { coins: 4000,  gems: 60,  price: 249 },
    ultimate: { coins: 10000, gems: 200, price: 499 },
  }

  try {
    const { packId, playerId } = req.body
    console.log('Request body:', { packId, playerId })

    if (!packId || !playerId) {
      return res.status(400).json({ error: 'Missing packId or playerId' })
    }

    const pack = COIN_PACKS[packId]
    if (!pack) {
      return res.status(400).json({ error: 'Invalid pack: ' + packId })
    }

    const order = await rzp.orders.create({
      amount: pack.price * 100,
      currency: 'INR',
      receipt: String(Date.now()),
    })

    console.log('Razorpay order created:', order.id)

    const insertData = {
      player_id: String(playerId),
      razorpay_order_id: String(order.id),
      amount: Number(pack.price),
      pack_id: String(packId),
      status: 'pending',
      coins_granted: Number(pack.coins),
      currency: 'INR',
    }

    console.log('Inserting into payments:', insertData)

    const { data, error: dbError } = await supabase
      .from('payments')
      .insert(insertData)
      .select()

    if (dbError) {
      console.error('DB insert error full:', JSON.stringify(dbError))
      return res.status(500).json({ error: 'DB error: ' + dbError.message + ' code: ' + dbError.code })
    }

    console.log('Payment record saved:', data)

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('create-order exception:', err.message, err.stack)
    return res.status(500).json({ error: err.message })
  }
}
