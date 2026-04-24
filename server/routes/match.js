import { Router } from 'express'
import { supabase } from '../supabase.js'
import { matchJobsForApplicant } from '../match.js'

const router = Router()

// POST /api/match/jobs
// Body: { applicant_id } OR { skills, experience, employment_type, district }
router.post('/jobs', async (req, res) => {
  let applicant = null

  if (req.body.applicant_id) {
    const { data, error } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', req.body.applicant_id)
      .single()
    if (error) return res.status(404).json({ error: 'Applicant not found' })
    applicant = data
  } else {
    applicant = {
      skills: req.body.skills || '',
      experience: req.body.experience || '',
      employment_type: req.body.employment_type || null,
      district: req.body.district || '',
    }
  }

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*, businesses(id, name, address, category)')
    .eq('status', 'active')
    .limit(50)

  if (jobsError) return res.status(500).json({ error: jobsError.message })
  if (!jobs || jobs.length === 0) return res.json({ matches: [] })

  try {
    const matches = await matchJobsForApplicant(applicant, jobs)
    res.json({ matches })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
