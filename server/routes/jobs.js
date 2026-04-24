import { Router } from 'express'
import { supabase } from '../supabase.js'

const router = Router()

router.get('/', async (req, res) => {
  const { search, employment_type, category, district, limit = 20, offset = 0 } = req.query

  let query = supabase
    .from('jobs')
    .select('*, businesses!inner(id, name, address, category)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  if (employment_type) query = query.eq('employment_type', employment_type)
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,requirements.ilike.%${search}%`)
  if (category) query = query.eq('businesses.category', category)
  if (district) query = query.ilike('businesses.address', `%${district}%`)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ jobs: data || [] })
})

router.get('/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('businesses!inner(category)')
    .eq('status', 'active')

  if (error) return res.status(500).json({ error: error.message })

  const categories = [...new Set((data || []).map(j => j.businesses?.category).filter(Boolean))].sort()
  res.json({ categories })
})

router.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, businesses(id, name, address, category, phone)')
    .eq('id', req.params.id)
    .single()

  if (error) return res.status(404).json({ error: 'Job not found' })
  res.json(data)
})

export default router
