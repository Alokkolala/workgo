const BASE = '/api'

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) }
  if (opts.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(BASE + path, {
    ...opts,
    headers,
  })

  const text = await response.text()
  return text ? JSON.parse(text) : null
}

export const getJobs = (params = {}) => {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value))
  ).toString()
  return req(`/jobs${query ? `?${query}` : ''}`)
}

export const getJobCategories = () => req('/jobs/categories')

export const getJob = (id) => req(`/jobs/${id}`)

export const createOrUpdateApplicant = (data) =>
  req('/applicants', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getApplicantById = (id) => req(`/applicants/${id}`)

export const getApplicantByPhone = (phone) => req(`/applicants/by-phone/${phone}`)

export const updateApplicant = (id, data) =>
  req(`/applicants/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })

export const applyToJob = async (data) => {
  const response = await fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  return {
    status: response.status,
    data: await response.json(),
  }
}

export const getApplicationsByApplicant = (applicantId) => req(`/applications/by-applicant/${applicantId}`)

export const getApplicationsByBusiness = (businessId) => req(`/applications/by-business/${businessId}`)

export const updateApplicationStatus = (id, status) =>
  req(`/applications/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

export const matchJobs = (data) =>
  req('/match/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const matchCandidates = (jobId) =>
  req('/match/candidates', {
    method: 'POST',
    body: JSON.stringify({ job_id: jobId }),
  })

export const getBusinesses = () => req('/businesses')

export const getBusinessStats = () => req('/businesses/stats')

export const getJobsByBusiness = (businessId) => req(`/jobs/by-business/${businessId}`)

export const getLatestBusinessJob = (businessId) => req(`/businesses/${businessId}/jobs`)

export const getMessages = (businessId) => req(`/messages/${businessId}`)

export const contactBusiness = (businessId) =>
  req(`/contact/${businessId}`, {
    method: 'POST',
  })

export const contactAll = () =>
  req('/contact-all', {
    method: 'POST',
  })

export const simulateReply = (data) =>
  req('/debug/reply', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const getHealth = () =>
  fetch('/health')
    .then((response) => response.json())
    .catch(() => ({ whatsapp: false }))

export const runScraper = (category = '') =>
  req('/scrape', {
    method: 'POST',
    body: JSON.stringify({ category }),
  })

export const deleteBusiness = (businessId) =>
  req(`/businesses/${businessId}`, { method: 'DELETE' })

export const createBusiness = (data) =>
  req('/businesses', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const clearBusinessMessages = (businessId) =>
  req(`/businesses/${businessId}/messages`, { method: 'DELETE' })

export const clearBusinessJob = (businessId) =>
  req(`/businesses/${businessId}/job`, { method: 'DELETE' })

export const resetBusinessStatus = (businessId, status = 'DISCOVERED') =>
  req(`/businesses/${businessId}/reset`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

export const sendManualMessage = (to, message) =>
  req('/send', {
    method: 'POST',
    body: JSON.stringify({ to, message }),
  })
