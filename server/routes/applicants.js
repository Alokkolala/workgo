import { Router } from 'express'
import { supabase } from '../supabase.js'

const router = Router()

// POST /api/applicants — register or update (upsert by phone)
router.post('/', async (req, res) => {
  const { name, phone, skills, experience, employment_type, district, bio } = req.body
  if (!name || !phone) return res.status(400).json({ error: 'name and phone are required' })

  const { data, error } = await supabase
    .from('applicants')
    .upsert(
      { name, phone, skills, experience, employment_type, district, bio, updated_at: new Date() },
      { onConflict: 'phone' }
    )
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// GET /api/applicants/by-phone/:phone — MUST come before /:id
router.get('/by-phone/:phone', async (req, res) => {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('phone', req.params.phone)
    .single()

  if (error) return res.status(404).json({ error: 'Applicant not found' })
  res.json(data)
})

// GET /api/applicants/:id
router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('applicants')
    .select('*')
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Applicant not found' })
  res.json(data)
})

// PATCH /api/applicants/:id
router.patch('/:id', async (req, res) => {
  const { name, skills, experience, employment_type, district, bio } = req.body
  const update = { updated_at: new Date() }
  if (name !== undefined) update.name = name
  if (skills !== undefined) update.skills = skills
  if (experience !== undefined) update.experience = experience
  if (employment_type !== undefined) update.employment_type = employment_type
  if (district !== undefined) update.district = district
  if (bio !== undefined) update.bio = bio

  const { data, error } = await supabase
    .from('applicants')
    .update(update)
    .eq('id', req.params.id)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
