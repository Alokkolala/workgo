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

// POST /api/businesses — create a business manually (demo)
router.post('/', async (req, res) => {
  const { name, phone, category } = req.body
  if (!name || !phone || !category) {
    return res.status(400).json({ ok: false, error: 'name, phone, and category are required' })
  }

  const CATEGORIES = ['Кафе/Ресторан', 'СТО/Автосервис', 'Магазин/Розница']
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ ok: false, error: `category must be one of: ${CATEGORIES.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('businesses')
    .insert([{ name, phone, category, status: 'DISCOVERED' }])
    .select()
    .single()

  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.status(201).json({ ok: true, data })
})

// DELETE /api/businesses/:id/messages — wipe all chat messages for a business
router.delete('/:id/messages', async (req, res) => {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('business_id', req.params.id)

  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.json({ ok: true })
})

export default router
