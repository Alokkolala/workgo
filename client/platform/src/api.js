const BASE = '/api'

// Jobs
export const getJobs = (params = {}) =>
  fetch(`${BASE}/jobs?${new URLSearchParams(params)}`).then(r => r.json())

export const getJobCategories = () =>
  fetch(`${BASE}/jobs/categories`).then(r => r.json())

export const getJob = (id) =>
  fetch(`${BASE}/jobs/${id}`).then(r => r.json())

// Applicants
export const createOrUpdateApplicant = (data) =>
  fetch(`${BASE}/applicants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json())

export const getApplicantById = (id) =>
  fetch(`${BASE}/applicants/${id}`).then(r => r.json())

export const getApplicantByPhone = (phone) =>
  fetch(`${BASE}/applicants/by-phone/${phone}`).then(r => r.json())

// Applications
export const applyToJob = (data) =>
  fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(async r => ({ status: r.status, data: await r.json() }))

export const getApplicationsByApplicant = (applicantId) =>
  fetch(`${BASE}/applications/by-applicant/${applicantId}`).then(r => r.json())

export const getApplicationsByBusiness = (businessId) =>
  fetch(`${BASE}/applications/by-business/${businessId}`).then(r => r.json())

export const updateApplicationStatus = (id, status) =>
  fetch(`${BASE}/applications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  }).then(r => r.json())

// Businesses (for employer lookup)
export const getBusinesses = () =>
  fetch(`${BASE}/businesses`).then(r => r.json())

// AI Matching
export const matchJobs = (data) =>
  fetch(`${BASE}/match/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json())

// Employer tools
export const getJobsByBusiness = (businessId) =>
  fetch(`${BASE}/jobs/by-business/${businessId}`).then(r => r.json())

export const matchCandidates = (jobId) =>
  fetch(`${BASE}/match/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId })
  }).then(r => r.json())
