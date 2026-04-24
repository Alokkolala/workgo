import { Router } from 'express'
import { supabase } from '../supabase.js'

const router = Router()

// GET /api/businesses — all businesses ordered by newest first
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.json({ ok: true, data })
})

// GET /api/businesses/stats
router.get('/stats', async (req, res) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('status')

  if (error) return res.status(500).json({ ok: false, error: error.message })

  const counts = data.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {})

  res.json({ ok: true, total: data.length, counts })
})

export default router
