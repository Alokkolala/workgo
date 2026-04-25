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

// DELETE /api/businesses/:id/job — delete all jobs for a business
router.delete('/:id/job', async (req, res) => {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('business_id', req.params.id)

  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.json({ ok: true })
})

// DELETE /api/businesses/:id — fully delete a business (messages, jobs, then business row)
router.delete('/:id', async (req, res) => {
  const { id } = req.params

  // Delete messages first (FK constraint)
  await supabase.from('messages').delete().eq('business_id', id)
  // Delete jobs (applications cascade via FK if configured, otherwise delete first)
  const { data: jobs } = await supabase.from('jobs').select('id').eq('business_id', id)
  if (jobs?.length) {
    const jobIds = jobs.map((j) => j.id)
    await supabase.from('applications').delete().in('job_id', jobIds)
  }
  await supabase.from('jobs').delete().eq('business_id', id)

  const { error } = await supabase.from('businesses').delete().eq('id', id)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.json({ ok: true })
})

// PATCH /api/businesses/:id/reset — set business back to a given status
router.patch('/:id/reset', async (req, res) => {
  const status = req.body.status || 'DISCOVERED'
  const allowed = ['DISCOVERED', 'CONTACTED', 'INTERESTED', 'COLLECTING', 'COMPLETED', 'REJECTED']
  if (!allowed.includes(status)) {
    return res.status(400).json({ ok: false, error: `status must be one of: ${allowed.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('businesses')
    .update({ status })
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ ok: false, error: error.message })
  res.json({ ok: true, data })
})

export default router
