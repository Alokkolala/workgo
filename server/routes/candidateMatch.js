import { Router } from 'express'
import { supabase } from '../supabase.js'
import { matchCandidatesForJob } from '../match.js'

const router = Router()

// POST /api/match/candidates
// Body: { job_id }
router.post('/candidates', async (req, res) => {
  const { job_id } = req.body
  if (!job_id) return res.status(400).json({ error: 'job_id is required' })

  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('*, businesses(name)')
    .eq('id', job_id)
    .single()

  if (jobErr || !job) return res.status(404).json({ error: 'Job not found' })

  const { data: applicants, error: appsErr } = await supabase
    .from('applicants')
    .select('id, name, phone, skills, experience, employment_type, district, bio')
    .not('skills', 'is', null)
    .limit(50)

  if (appsErr) return res.status(500).json({ error: appsErr.message })
  if (!applicants || applicants.length === 0) return res.json({ matches: [] })

  try {
    const matches = await matchCandidatesForJob(job, applicants)
    res.json({ matches })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
