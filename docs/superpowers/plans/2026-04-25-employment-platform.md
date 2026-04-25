# Employment Platform MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public-facing job board platform (job seekers + employer view) on top of the existing WhatsApp agent that populates the `jobs` table.

**Architecture:** New Express routes for public jobs/applicants/applications APIs + a Gemini AI matching endpoint. A Vite + React SPA in `client/platform/` serves as the public-facing product with React Router for navigation. No auth — phone number is the identity token; applicant ID stored in localStorage. Express serves the built React app in production; Vite dev server proxies `/api` to Express during development.

**Tech Stack:** Node.js + Express (existing), Supabase Postgres, `@google/generative-ai` (existing), Vite + React 18, React Router DOM, Tailwind CSS Play CDN

---

## File Map

**Create (server):**
- `server/routes/jobs.js` — public jobs API: list, search, filter, single
- `server/routes/applicants.js` — applicant CRUD (register/get/update by phone)
- `server/routes/applications.js` — apply to job, list applications
- `server/routes/match.js` — AI matching endpoint
- `server/match.js` — Gemini matching logic (isolated from WhatsApp agent)

**Modify (server):**
- `server/index.js` — register 4 new route modules + serve React build

**Create (React app — `client/platform/`):**
- `package.json` — react, react-dom, react-router-dom, vite
- `vite.config.js` — proxy /api → localhost:3000
- `index.html` — Tailwind CDN, mount point
- `src/main.jsx` — ReactDOM render
- `src/App.jsx` — React Router routes
- `src/api.js` — all fetch helpers (jobs, applicants, applications, match)
- `src/pages/JobBoard.jsx` — job listing, search, filters, AI match modal
- `src/pages/JobDetail.jsx` — job info + apply modal
- `src/pages/Profile.jsx` — applicant profile form + my applications
- `src/pages/Employer.jsx` — employer search + applicant management
- `src/components/JobCard.jsx` — reusable job card
- `src/components/FilterBar.jsx` — search + filter controls
- `src/components/MatchModal.jsx` — AI job matching modal
- `src/components/ApplyModal.jsx` — apply + quick register modal

---

## Task 1: Database Schema — New Tables

**Files:** SQL to run in Supabase SQL Editor (manual step)

- [ ] **Step 1: Run migration SQL in Supabase SQL Editor**

```sql
-- Job seekers
create table if not exists applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  skills text,
  experience text,        -- '0-1 лет' | '1-3 лет' | '3+ лет'
  employment_type text,   -- preferred: 'full' | 'part' | 'gig' | null
  district text,          -- preferred district in Aktau
  bio text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- One application per job per person
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id) on delete cascade,
  applicant_id uuid references applicants(id) on delete cascade,
  status text default 'pending',   -- 'pending' | 'viewed' | 'accepted' | 'rejected'
  cover_message text,
  created_at timestamp default now(),
  unique(job_id, applicant_id)
);
```

- [ ] **Step 2: Verify in Supabase Table Editor** — confirm `applicants` and `applications` appear with correct columns.

---

## Task 2: Jobs Public API

**Files:**
- Create: `server/routes/jobs.js`

- [ ] **Step 1: Create `server/routes/jobs.js`**

```javascript
import { Router } from 'express'
import { supabase } from '../supabase.js'

const router = Router()

// GET /api/jobs?search=&employment_type=&category=&district=&limit=20&offset=0
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

// GET /api/jobs/categories — must come before /:id
router.get('/categories', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('businesses!inner(category)')
    .eq('status', 'active')

  if (error) return res.status(500).json({ error: error.message })

  const categories = [...new Set((data || []).map(j => j.businesses?.category).filter(Boolean))].sort()
  res.json({ categories })
})

// GET /api/jobs/:id
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
```

- [ ] **Step 2: Test**

```bash
curl "http://localhost:3000/api/jobs"
# Expected: { "jobs": [...] }
curl "http://localhost:3000/api/jobs/categories"
# Expected: { "categories": ["кафе", ...] }
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/jobs.js
git commit -m "feat(api): add public jobs routes with search and filter"
```

---

## Task 3: Applicants API

**Files:**
- Create: `server/routes/applicants.js`

- [ ] **Step 1: Create `server/routes/applicants.js`**

```javascript
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

// GET /api/applicants/by-phone/:phone — must come before /:id
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
```

- [ ] **Step 2: Test**

```bash
curl -X POST http://localhost:3000/api/applicants \
  -H "Content-Type: application/json" \
  -d '{"name":"Айдар","phone":"87771234567","skills":"водитель","experience":"1-3 лет"}'
# Expected: applicant object with id

curl http://localhost:3000/api/applicants/by-phone/87771234567
# Expected: same applicant
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/applicants.js
git commit -m "feat(api): add applicants CRUD routes with phone upsert"
```

---

## Task 4: Applications API

**Files:**
- Create: `server/routes/applications.js`

- [ ] **Step 1: Create `server/routes/applications.js`**

```javascript
import { Router } from 'express'
import { supabase } from '../supabase.js'

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
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

export default router
```

- [ ] **Step 2: Test**

```bash
# Use real UUIDs from your DB
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<JOB_ID>","applicant_id":"<APPLICANT_ID>","cover_message":"Хочу работать"}'
# Expected: application object with status 'pending'

# Duplicate apply → 409
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<JOB_ID>","applicant_id":"<APPLICANT_ID>"}'
# Expected: 409
```

- [ ] **Step 3: Commit**

```bash
git add server/routes/applications.js
git commit -m "feat(api): add applications routes (apply, list, update status)"
```

---

## Task 5: AI Matching Engine

**Files:**
- Create: `server/match.js`
- Create: `server/routes/match.js`

- [ ] **Step 1: Create `server/match.js`**

```javascript
import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP_1,
  process.env.GEMINI_API_KEY_BACKUP_2,
].filter(Boolean)

if (apiKeys.length === 0) throw new Error('No GEMINI_API_KEY configured')

let keyIndex = 0
const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

function getModel() {
  const genAI = new GoogleGenerativeAI(apiKeys[keyIndex])
  return genAI.getGenerativeModel({ model: modelName })
}

/**
 * Returns top matching jobs for an applicant profile.
 * @param {{ skills, experience, employment_type, district }} applicant
 * @param {Array} jobs - job objects with businesses joined
 * @returns {Promise<Array<{ job_id, score, reason, job }>>}
 */
export async function matchJobsForApplicant(applicant, jobs) {
  if (!jobs.length) return []

  const prompt = `Ты — AI для подбора вакансий на платформе занятости в Актау, Казахстан.

Профиль соискателя:
- Навыки: ${applicant.skills || 'не указаны'}
- Опыт: ${applicant.experience || 'не указан'}
- Желаемый тип занятости: ${applicant.employment_type || 'любой'}
- Район: ${applicant.district || 'любой'}

Список активных вакансий (JSON):
${JSON.stringify(jobs.map(j => ({
  id: j.id,
  title: j.title,
  description: j.description,
  salary: j.salary,
  employment_type: j.employment_type,
  requirements: j.requirements,
  business_name: j.businesses?.name,
  address: j.businesses?.address
})))}

Верни ТОЛЬКО JSON-массив до 5 лучших совпадений (score >= 5).
Формат: [{"job_id":"uuid","score":1-10,"reason":"краткое объяснение на русском"}]
Отсортируй по score убывания. Ничего кроме JSON.`

  let raw = null
  let lastError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = getModel()
      const result = await model.generateContent(prompt)
      raw = result.response.text()
      break
    } catch (err) {
      lastError = err
      if (attempt < 3 && (err.message.includes('API_KEY_INVALID') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('403'))) {
        keyIndex = (keyIndex + 1) % apiKeys.length
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000))
    }
  }

  if (!raw) throw new Error(`Gemini match failed: ${lastError?.message}`)

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const matches = JSON.parse(match[0])
    return matches
      .filter(m => jobs.find(j => j.id === m.job_id))
      .map(m => ({ ...m, job: jobs.find(j => j.id === m.job_id) }))
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Create `server/routes/match.js`**

```javascript
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
```

- [ ] **Step 3: Test**

```bash
curl -X POST http://localhost:3000/api/match/jobs \
  -H "Content-Type: application/json" \
  -d '{"skills":"повар","experience":"1-3 лет","employment_type":"full"}'
# Expected: { "matches": [{ "job_id": "...", "score": 8, "reason": "...", "job": {...} }] }
```

- [ ] **Step 4: Commit**

```bash
git add server/match.js server/routes/match.js
git commit -m "feat(ai): add Gemini job matching engine and API route"
```

---

## Task 6: Register Routes + Serve React Build

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add imports after existing route imports (around line 13)**

Add these 4 lines after the `import businessesRouter` line:

```javascript
import jobsRouter from './routes/jobs.js'
import applicantsRouter from './routes/applicants.js'
import applicationsRouter from './routes/applications.js'
import matchRouter from './routes/match.js'
```

- [ ] **Step 2: Mount routes after existing `app.use('/api/businesses', businessesRouter)` line**

```javascript
app.use('/api/jobs', jobsRouter)
app.use('/api/applicants', applicantsRouter)
app.use('/api/applications', applicationsRouter)
app.use('/api/match', matchRouter)
```

- [ ] **Step 3: Add SPA catch-all for React app after the existing `app.use(express.static(...))` call**

The existing static middleware serves `client/`. Add below it:

```javascript
// Serve React platform SPA
app.use('/platform', express.static(join(__dirname, '../client/platform/dist')))
app.get('/platform/*', (req, res) => {
  res.sendFile(join(__dirname, '../client/platform/dist/index.html'))
})
```

- [ ] **Step 4: Verify server starts cleanly**

```bash
npm run dev
# Expected: Server running on http://localhost:3000 — no import errors
curl http://localhost:3000/api/jobs
# Expected: { "jobs": [...] }
```

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat(server): register platform routes and serve React SPA build"
```

---

## Task 7: React App Scaffold

**Files:**
- Create: `client/platform/package.json`
- Create: `client/platform/vite.config.js`
- Create: `client/platform/index.html`
- Create: `client/platform/src/main.jsx`
- Create: `client/platform/src/App.jsx`
- Create: `client/platform/src/api.js`

- [ ] **Step 1: Create `client/platform/package.json`**

```json
{
  "name": "workgo-platform",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd client/platform && npm install
```

Expected: `node_modules` created, no errors.

- [ ] **Step 3: Create `client/platform/vite.config.js`**

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/platform/',
  server: {
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist'
  }
})
```

- [ ] **Step 4: Create `client/platform/index.html`**

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkGo — Работа в Актау</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create `client/platform/src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 6: Create `client/platform/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import JobBoard from './pages/JobBoard.jsx'
import JobDetail from './pages/JobDetail.jsx'
import Profile from './pages/Profile.jsx'
import Employer from './pages/Employer.jsx'

export default function App() {
  return (
    <BrowserRouter basename="/platform">
      <Routes>
        <Route path="/" element={<JobBoard />} />
        <Route path="/job/:id" element={<JobDetail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/employer" element={<Employer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 7: Create `client/platform/src/api.js`**

```javascript
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
```

- [ ] **Step 8: Verify dev server starts**

```bash
cd client/platform && npm run dev
# Expected: Vite dev server at http://localhost:5173/platform/
# Page loads (will show errors for missing pages — that's expected)
```

- [ ] **Step 9: Commit**

```bash
cd ../..
git add client/platform/package.json client/platform/vite.config.js client/platform/index.html client/platform/src/
git commit -m "feat(platform): scaffold Vite + React app with router and API helpers"
```

---

## Task 8: Job Board Page + Shared Components

**Files:**
- Create: `client/platform/src/pages/JobBoard.jsx`
- Create: `client/platform/src/components/JobCard.jsx`
- Create: `client/platform/src/components/FilterBar.jsx`
- Create: `client/platform/src/components/MatchModal.jsx`

- [ ] **Step 1: Create `client/platform/src/components/JobCard.jsx`**

```jsx
import { Link } from 'react-router-dom'

const TYPE_LABEL = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
const TYPE_CLASS = {
  full: 'bg-green-100 text-green-800',
  part: 'bg-blue-100 text-blue-800',
  gig: 'bg-yellow-100 text-yellow-800'
}

export default function JobCard({ job, matchReason }) {
  const biz = job.businesses || {}
  return (
    <Link
      to={`/job/${job.id}`}
      className="block bg-white rounded-xl p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border border-transparent hover:border-blue-100"
    >
      {matchReason && (
        <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1 mb-3">
          ✨ {matchReason}
        </p>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title || 'Вакансия'}</h3>
          <p className="text-sm text-gray-500 truncate">{biz.name}</p>
        </div>
        {job.salary && (
          <span className="text-sm font-bold text-green-700 whitespace-nowrap">{job.salary}</span>
        )}
      </div>
      {job.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{job.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {job.employment_type && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_CLASS[job.employment_type] || 'bg-gray-100 text-gray-600'}`}>
            {TYPE_LABEL[job.employment_type] || job.employment_type}
          </span>
        )}
        {biz.address && (
          <span className="text-xs text-gray-400 truncate">📍 {biz.address.slice(0, 35)}</span>
        )}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Create `client/platform/src/components/FilterBar.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { getJobCategories } from '../api.js'

export default function FilterBar({ filters, onChange }) {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    getJobCategories().then(({ categories }) => setCategories(categories || []))
  }, [])

  const set = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div className="bg-white border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">
        <select
          value={filters.employment_type || ''}
          onChange={e => set('employment_type', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Тип занятости</option>
          <option value="full">Полная</option>
          <option value="part">Частичная</option>
          <option value="gig">Подработка</option>
        </select>

        <select
          value={filters.category || ''}
          onChange={e => set('category', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Все сферы</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filters.district || ''}
          onChange={e => set('district', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Весь Актау</option>
          <option value="1-й мкр">1–6-й мкр</option>
          <option value="7-й мкр">7–12-й мкр</option>
          <option value="14-й мкр">14-й мкр</option>
          <option value="17-й мкр">17-й мкр</option>
          <option value="27-й мкр">27-й мкр</option>
          <option value="Новый город">Новый город</option>
        </select>

        {(filters.employment_type || filters.category || filters.district) && (
          <button
            onClick={() => onChange({ search: filters.search })}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            × Сбросить
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `client/platform/src/components/MatchModal.jsx`**

```jsx
import { useState } from 'react'
import { matchJobs } from '../api.js'

export default function MatchModal({ onClose, onMatches }) {
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [loading, setLoading] = useState(false)

  async function run() {
    if (!skills.trim()) return
    setLoading(true)
    try {
      const { matches } = await matchJobs({ skills, experience, employment_type: employmentType })
      if (!matches || matches.length === 0) {
        alert('Подходящих вакансий не найдено. Попробуйте изменить навыки.')
        return
      }
      onMatches(matches)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">✨ AI подбор вакансий</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ваши навыки *</label>
            <input
              value={skills}
              onChange={e => setSkills(e.target.value)}
              placeholder="повар, кассир, водитель..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Опыт работы</label>
            <select
              value={experience}
              onChange={e => setExperience(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">Не важно</option>
              <option value="0-1 лет">Без опыта / до 1 года</option>
              <option value="1-3 лет">1–3 года</option>
              <option value="3+ лет">3+ лет</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Тип занятости</label>
            <select
              value={employmentType}
              onChange={e => setEmploymentType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">Любой</option>
              <option value="full">Полная занятость</option>
              <option value="part">Частичная</option>
              <option value="gig">Подработка</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
            Отмена
          </button>
          <button
            onClick={run}
            disabled={loading || !skills.trim()}
            className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Анализирую...' : 'Найти подходящие'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `client/platform/src/pages/JobBoard.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getJobs } from '../api.js'
import JobCard from '../components/JobCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import MatchModal from '../components/MatchModal.jsx'

export default function JobBoard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [showMatch, setShowMatch] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState(null) // null = show all

  useEffect(() => {
    loadJobs()
  }, [filters])

  async function loadJobs() {
    setLoading(true)
    setMatchedJobs(null)
    const params = { ...filters }
    if (search.trim()) params.search = search.trim()
    const { jobs } = await getJobs(params)
    setJobs(jobs || [])
    setLoading(false)
  }

  function handleSearch(e) {
    if (e.key === 'Enter') loadJobs()
  }

  function handleMatches(matches) {
    setMatchedJobs(matches)
    setJobs(matches.map(m => m.job))
  }

  const displayJobs = matchedJobs
    ? matchedJobs.map(m => ({ ...m.job, _matchReason: m.reason }))
    : jobs

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-blue-600">WorkGo</span>
            <span className="text-gray-400 text-sm ml-2 hidden sm:inline">Работа в Актау</span>
          </div>
          <div className="flex gap-3 text-sm">
            <Link to="/profile" className="text-blue-600 hover:underline">Мой профиль</Link>
            <Link to="/employer" className="text-gray-500 hover:underline">Работодателям</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Найди работу рядом с домом</h1>
          <p className="text-blue-200 mb-6">Реальные вакансии малого бизнеса Мангистауской области</p>
          <div className="flex gap-2 max-w-2xl">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Профессия, должность..."
              className="flex-1 px-4 py-3 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={loadJobs}
              className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition text-sm"
            >
              Найти
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* AI Match + count bar */}
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {loading ? 'Загрузка...' : matchedJobs ? `${displayJobs.length} AI-подобранных` : `${displayJobs.length} вакансий`}
        </span>
        <div className="flex gap-2">
          {matchedJobs && (
            <button onClick={loadJobs} className="text-sm text-blue-500 hover:underline">
              ← Все вакансии
            </button>
          )}
          <button
            onClick={() => setShowMatch(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
          >
            ✨ AI подбор
          </button>
        </div>
      </div>

      {/* Jobs grid */}
      <main className="max-w-5xl mx-auto px-4 pb-10">
        {loading && (
          <div className="text-center py-16 text-gray-400">Загружаем вакансии...</div>
        )}
        {!loading && displayJobs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Вакансий не найдено</p>
            <p className="text-sm mt-1">Попробуйте изменить фильтры</p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {displayJobs.map(job => (
            <JobCard key={job.id} job={job} matchReason={job._matchReason} />
          ))}
        </div>
      </main>

      {showMatch && (
        <MatchModal onClose={() => setShowMatch(false)} onMatches={handleMatches} />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify in browser**

```bash
cd client/platform && npm run dev
```

Open `http://localhost:5173/platform/` — confirm:
- Job cards render with title, salary, badge, address
- Search filters on Enter
- Type/category/district dropdowns work
- AI подбор opens modal

- [ ] **Step 6: Commit**

```bash
cd ../..
git add client/platform/src/pages/JobBoard.jsx client/platform/src/components/
git commit -m "feat(platform): add job board page with filters, cards, and AI match modal"
```

---

## Task 9: Job Detail + Apply Page

**Files:**
- Create: `client/platform/src/pages/JobDetail.jsx`
- Create: `client/platform/src/components/ApplyModal.jsx`

- [ ] **Step 1: Create `client/platform/src/components/ApplyModal.jsx`**

```jsx
import { useState } from 'react'
import { createOrUpdateApplicant, applyToJob } from '../api.js'

export default function ApplyModal({ jobId, onClose }) {
  const saved = JSON.parse(localStorage.getItem('wg_applicant') || '{}')
  const [name, setName] = useState(saved.name || '')
  const [phone, setPhone] = useState(saved.phone || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!name.trim() || !phone.trim()) { setError('Введите имя и телефон'); return }
    setError('')
    setLoading(true)
    try {
      const applicant = await createOrUpdateApplicant({ name: name.trim(), phone: phone.trim() })
      if (applicant.error) { setError(applicant.error); return }

      localStorage.setItem('wg_applicant', JSON.stringify({ id: applicant.id, name: applicant.name, phone: applicant.phone }))

      const { status, data } = await applyToJob({
        job_id: jobId,
        applicant_id: applicant.id,
        cover_message: message.trim() || null
      })

      if (status === 409) { setError('Вы уже откликались на эту вакансию'); return }
      if (status >= 400) { setError(data.error || 'Ошибка. Попробуйте позже'); return }

      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Отклик на вакансию</h2>

        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-semibold text-gray-800">Отклик отправлен!</p>
            <p className="text-sm text-gray-500 mt-1">Работодатель свяжется с вами по телефону</p>
            <button onClick={onClose} className="mt-4 text-blue-600 text-sm hover:underline">Закрыть</button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Ваше имя *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Айдар Сейткали"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Номер телефона *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="87001234567"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Сопроводительное сообщение</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="Почему хотите здесь работать?"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={submit} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Отправляем...' : 'Отправить отклик'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `client/platform/src/pages/JobDetail.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getJob } from '../api.js'
import ApplyModal from '../components/ApplyModal.jsx'

const TYPE_LABEL = { full: 'Полная занятость', part: 'Частичная занятость', gig: 'Подработка' }
const TYPE_CLASS = {
  full: 'bg-green-100 text-green-800',
  part: 'bg-blue-100 text-blue-800',
  gig: 'bg-yellow-100 text-yellow-800'
}

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)

  useEffect(() => {
    getJob(id).then(data => { setJob(data.error ? null : data); setLoading(false) })
  }, [id])

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!job) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-400">
      <p className="text-lg">Вакансия не найдена</p>
      <Link to="/" className="text-blue-500 mt-2 hover:underline">← Все вакансии</Link>
    </div>
  )

  const biz = job.businesses || {}

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-gray-400 hover:text-gray-700 text-sm">← Все вакансии</Link>
          <span className="text-xl font-bold text-blue-600">WorkGo</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Job header card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-blue-600 font-medium mt-1">{biz.name}</p>
              {biz.address && <p className="text-sm text-gray-400 mt-0.5">📍 {biz.address}</p>}
            </div>
            <div className="text-right shrink-0">
              {job.salary && <p className="text-xl font-bold text-green-700">{job.salary}</p>}
              {job.employment_type && (
                <span className={`text-xs px-3 py-1 rounded-full font-medium mt-1 inline-block ${TYPE_CLASS[job.employment_type] || ''}`}>
                  {TYPE_LABEL[job.employment_type] || job.employment_type}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowApply(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition"
          >
            Откликнуться
          </button>
        </div>

        {/* Details */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">О вакансии</h2>
          {job.description
            ? <p className="text-gray-600 text-sm leading-relaxed mb-4">{job.description}</p>
            : <p className="text-gray-400 text-sm mb-4">Описание не указано</p>
          }
          {job.requirements && (
            <>
              <h3 className="font-medium text-gray-800 mb-2 text-sm">Требования</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{job.requirements}</p>
            </>
          )}
        </div>
      </main>

      {showApply && <ApplyModal jobId={id} onClose={() => setShowApply(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

1. Click a job card on the board → `JobDetail` renders with title, salary, business info
2. Click "Откликнуться" → `ApplyModal` opens
3. Fill name + phone → submit → success screen
4. Check Supabase `applications` table for new row

- [ ] **Step 4: Commit**

```bash
git add client/platform/src/pages/JobDetail.jsx client/platform/src/components/ApplyModal.jsx
git commit -m "feat(platform): add job detail page and apply modal"
```

---

## Task 10: Profile + Employer Pages

**Files:**
- Create: `client/platform/src/pages/Profile.jsx`
- Create: `client/platform/src/pages/Employer.jsx`

- [ ] **Step 1: Create `client/platform/src/pages/Profile.jsx`**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createOrUpdateApplicant, getApplicantById, getApplicationsByApplicant, matchJobs } from '../api.js'

const TYPE_LABEL = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
const STATUS_LABEL = { pending: 'Ожидает', viewed: 'Просмотрено', accepted: 'Принят', rejected: 'Отказ' }
const STATUS_COLOR = { pending: 'text-yellow-600', viewed: 'text-blue-600', accepted: 'text-green-600', rejected: 'text-gray-400' }

export default function Profile() {
  const [form, setForm] = useState({ name: '', phone: '', skills: '', experience: '', employment_type: '', district: '', bio: '' })
  const [applications, setApplications] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [saving, setSaving] = useState(false)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wg_applicant') || '{}')
    if (saved.id) {
      getApplicantById(saved.id).then(p => {
        if (!p.error) setForm({ name: p.name || '', phone: p.phone || '', skills: p.skills || '', experience: p.experience || '', employment_type: p.employment_type || '', district: p.district || '', bio: p.bio || '' })
      })
      getApplicationsByApplicant(saved.id).then(setApplications)
    }
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) { setMsg({ text: 'Введите имя и телефон', type: 'error' }); return }
    setSaving(true)
    const applicant = await createOrUpdateApplicant(form)
    setSaving(false)
    if (applicant.error) { setMsg({ text: applicant.error, type: 'error' }); return }
    localStorage.setItem('wg_applicant', JSON.stringify({ id: applicant.id, name: applicant.name, phone: applicant.phone }))
    setMsg({ text: '✅ Профиль сохранён', type: 'success' })
    getApplicationsByApplicant(applicant.id).then(setApplications)
  }

  async function findMatches() {
    if (!form.skills.trim()) { alert('Укажите навыки для AI-подбора'); return }
    setMatching(true)
    const { matches } = await matchJobs({ skills: form.skills, experience: form.experience, employment_type: form.employment_type, district: form.district })
    setMatching(false)
    if (!matches?.length) { alert('Подходящих вакансий не найдено'); return }
    sessionStorage.setItem('wg_matches', JSON.stringify(matches))
    window.location.href = '/platform/'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-gray-400 hover:text-gray-700 text-sm">← Вакансии</Link>
          <span className="text-xl font-bold text-blue-600">WorkGo</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Мой профиль</h1>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Имя *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Айдар"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Телефон *</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="87001234567"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Навыки</label>
            <input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="повар, водитель, продавец..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Опыт</label>
              <select value={form.experience} onChange={e => set('experience', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Не указано</option>
                <option value="0-1 лет">До 1 года</option>
                <option value="1-3 лет">1–3 года</option>
                <option value="3+ лет">3+ лет</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Тип занятости</label>
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Не важно</option>
                <option value="full">Полная</option>
                <option value="part">Частичная</option>
                <option value="gig">Подработка</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Район Актау</label>
            <select value={form.district} onChange={e => set('district', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Не важно</option>
              <option value="1-й мкр">1–6-й мкр</option>
              <option value="7-й мкр">7–12-й мкр</option>
              <option value="14-й мкр">14-й мкр</option>
              <option value="17-й мкр">17-й мкр</option>
              <option value="27-й мкр">27-й мкр</option>
              <option value="Новый город">Новый город</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">О себе</label>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>
          {msg.text && <p className={`text-sm ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{msg.text}</p>}
          <button onClick={save} disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Сохраняем...' : 'Сохранить профиль'}
          </button>
          <button onClick={findMatches} disabled={matching}
            className="w-full border border-purple-500 text-purple-600 py-2 rounded-xl text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition">
            {matching ? 'AI анализирует...' : '✨ Найти подходящие вакансии'}
          </button>
        </div>

        <h2 className="text-lg font-bold mb-3">Мои отклики</h2>
        {!applications.length
          ? <p className="text-gray-400 text-sm bg-white rounded-xl p-4 shadow-sm">
              Откликов нет. <Link to="/" className="text-blue-500 hover:underline">Найти вакансии →</Link>
            </p>
          : applications.map(app => {
              const job = app.jobs || {}
              const biz = job.businesses || {}
              return (
                <div key={app.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{job.title || 'Вакансия'}</p>
                    <p className="text-sm text-gray-500">{biz.name} {job.salary ? `• ${job.salary}` : ''}</p>
                    <p className="text-xs text-gray-400">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <span className={`text-sm font-medium ${STATUS_COLOR[app.status] || ''}`}>
                    {STATUS_LABEL[app.status] || app.status}
                  </span>
                </div>
              )
            })
        }
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `client/platform/src/pages/Employer.jsx`**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getBusinesses, getApplicationsByBusiness, updateApplicationStatus } from '../api.js'

const STATUS_LABEL = { pending: 'Новый', viewed: 'Просмотрено', accepted: 'Принят', rejected: 'Отказ' }
const STATUS_CLASS = {
  pending: 'bg-yellow-100 text-yellow-700',
  viewed: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500'
}

export default function Employer() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedBiz, setSelectedBiz] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    const { data } = await getBusinesses()
    const matches = (data || []).filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
    setResults(matches.slice(0, 6))
  }

  async function selectBusiness(biz) {
    setSelectedBiz(biz)
    setResults([])
    setQuery(biz.name)
    setLoading(true)
    const apps = await getApplicationsByBusiness(biz.id)
    setApplications(Array.isArray(apps) ? apps : [])
    setLoading(false)
  }

  async function changeStatus(appId, status) {
    await updateApplicationStatus(appId, status)
    if (selectedBiz) {
      const apps = await getApplicationsByBusiness(selectedBiz.id)
      setApplications(Array.isArray(apps) ? apps : [])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-gray-400 hover:text-gray-700 text-sm">← Вакансии</Link>
          <span className="text-xl font-bold text-blue-600">WorkGo</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Для работодателей</h1>
        <p className="text-gray-500 text-sm mb-6">Найдите свой бизнес и просмотрите отклики</p>

        {/* Lookup */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <label className="text-sm text-gray-600 mb-2 block">Название вашего бизнеса</label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Кафе, СТО, магазин..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button onClick={search} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Найти
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map(b => (
                <button key={b.id} onClick={() => selectBusiness(b)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm border hover:border-blue-200 transition">
                  <span className="font-medium">{b.name}</span>
                  {b.category && <span className="text-gray-400 ml-2">{b.category}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Applications */}
        {selectedBiz && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Отклики — {selectedBiz.name}</h2>
              <span className="text-sm text-gray-400">{applications.length} откликов</span>
            </div>
            {loading && <p className="text-gray-400 text-sm">Загрузка...</p>}
            {!loading && applications.length === 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-400 text-sm">Откликов пока нет</div>
            )}
            {applications.map(app => {
              const ap = app.applicants || {}
              const job = app.jobs || {}
              return (
                <div key={app.id} className="bg-white rounded-xl p-5 shadow-sm mb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{ap.name || 'Соискатель'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[app.status] || ''}`}>
                          {STATUS_LABEL[app.status] || app.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">На вакансию: <span className="font-medium">{job.title}</span></p>
                      {ap.skills && <p className="text-sm text-gray-600 mt-1">Навыки: {ap.skills}</p>}
                      {ap.experience && <p className="text-xs text-gray-400">Опыт: {ap.experience}</p>}
                      {ap.district && <p className="text-xs text-gray-400">Район: {ap.district}</p>}
                      {app.cover_message && <p className="text-sm text-gray-500 mt-2 italic">"{app.cover_message}"</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {ap.phone && (
                        <a href={`tel:${ap.phone}`} className="text-blue-600 font-semibold text-sm hover:underline block">{ap.phone}</a>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => changeStatus(app.id, 'accepted')}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 transition">
                      ✓ Принять
                    </button>
                    <button onClick={() => changeStatus(app.id, 'viewed')}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition">
                      Просмотрено
                    </button>
                    <button onClick={() => changeStatus(app.id, 'rejected')}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition">
                      ✗ Отказ
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

1. Go to `/platform/profile` — fill form, save, check Supabase `applicants`
2. Go to `/platform/employer` — search a business, see applications, change status
3. Click "✨ Найти подходящие вакансии" — redirects to job board

- [ ] **Step 4: Commit**

```bash
git add client/platform/src/pages/Profile.jsx client/platform/src/pages/Employer.jsx
git commit -m "feat(platform): add applicant profile and employer management pages"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ 01 Real backend + DB — Express + Supabase, all data persisted
- ✅ 02 Live DB queries — every action (register, apply, filter, match) is a real Supabase query
- ✅ 03 AI matching — `POST /api/match/jobs` with Gemini, surface on job board, profile, and standalone modal
- ⏭️ 04 Telegram bot — explicitly excluded per user ("focus only on platform and database for now")
- ✅ 05 Search and filters — employment_type, category (via businesses join), district (via address ilike), full-text search
- ✅ 06 Apply and connect — full flow: apply → saved → employer sees applicant phone → accepts/rejects

**React-specific checks:**
- `BrowserRouter` uses `basename="/platform"` to match Express static route
- `vite.config.js` sets `base: '/platform/'` so assets resolve correctly after build
- `/api/jobs/categories` registered before `/:id` in Express router — prevents "categories" being treated as a job ID
- `/api/applicants/by-phone/:phone` registered before `/:id` for same reason
- `api.js` is the single source of truth for all fetch calls — no inline fetches in components
- `employment_type` values `'full' | 'part' | 'gig'` consistent across DB, API, and all dropdowns
- `status` values `'pending' | 'viewed' | 'accepted' | 'rejected'` consistent across API validation, labels, and colors
