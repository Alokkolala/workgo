import { Router } from 'express'
import { supabase } from '../supabase.js'
import { notifyApplicantStatusChange, notifyEmployerNewApplication } from '../telegram.js'

const router = Router()

// POST /api/applications — apply to a job
router.post('/', async (req, res) => {
  const { job_id, applicant_id, cover_message } = req.body
  if (!job_id || !applicant_id) {
    return res.status(400).json({ error: 'job_id and applicant_id are required' })
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({ job_id, applicant_id, cover_message: cover_message || null })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'Вы уже откликались на эту вакансию' })
    return res.status(500).json({ error: error.message })
  }
  res.json(data)

  // Notify employer via Telegram (fire and forget)
  supabase
    .from('applicants')
    .select('name')
    .eq('id', applicant_id)
    .maybeSingle()
    .then(({ data: applicant }) => {
      notifyEmployerNewApplication(job_id, applicant?.name || 'Соискатель').catch(() => {})
    })
    .catch(() => {})
})

// GET /api/applications/by-applicant/:applicantId
router.get('/by-applicant/:applicantId', async (req, res) => {
  const { data, error } = await supabase
    .from('applications')
    .select('*, jobs(id, title, salary, employment_type, businesses(name, address))')
    .eq('applicant_id', req.params.applicantId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// GET /api/applications/by-business/:businessId
router.get('/by-business/:businessId', async (req, res) => {
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id')
    .eq('business_id', req.params.businessId)

  if (jobsError) return res.status(500).json({ error: jobsError.message })
  if (!jobs || jobs.length === 0) return res.json([])

  const jobIds = jobs.map(j => j.id)

  const { data, error } = await supabase
    .from('applications')
    .select('*, applicants(id, name, phone, skills, experience, district), jobs(id, title, salary)')
    .in('job_id', jobIds)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})

// PATCH /api/applications/:id — update status
router.patch('/:id', async (req, res) => {
  const { status } = req.body
  const allowed = ['pending', 'viewed', 'accepted', 'rejected']
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
  }

  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', req.params.id)
    .select('*, jobs(title)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)

  // Notify applicant via Telegram (fire and forget)
  const jobTitle = data.jobs?.title || 'Вакансия'
  notifyApplicantStatusChange(data.applicant_id, jobTitle, status).catch(() => {})
})

export default router
