# Mangystau Jobs Platform — Claude Code Instructions

## What We're Building
An AI-powered employment platform for Aktau, Kazakhstan targeting youth and small businesses.
The unique differentiator: an autonomous agent that scrapes businesses from 2GIS, contacts them
via WhatsApp, and collects job postings through a multi-turn AI conversation — populating the
platform with real employer data.

## Stack
- **Runtime:** Node.js + Express
- **Database:** Supabase (Postgres + Realtime)
- **AI:** Google Gemini (using `@google/generative-ai`) — active model: `gemini-3.1-flash-lite-preview` (set via `GEMINI_MODEL` in `.env`)
- **Scraping:** Playwright
- **WhatsApp:** whatsapp-web.js
- **Frontend (Control Center):** HTML/JS two-panel dashboard — live SSE + Supabase Realtime (`client/index.html`)
- **Frontend (Job Platform):** React + Vite SPA served at `/platform/` (`client/platform/`) — Tailwind via CDN (switch to PostCSS plugin before production)

## Environment Variables
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
GEMINI_API_KEY=
GEMINI_API_KEY_BACKUP_1= (optional)
GEMINI_API_KEY_BACKUP_2= (optional)
GEMINI_MODEL=gemini-3.1-flash-lite-preview
PORT=4242
```

## Database Schema (Supabase)

```sql
-- Businesses discovered by 2GIS scraper
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  category text,
  address text,
  status text default 'DISCOVERED',
  -- DISCOVERED → CONTACTED → INTERESTED → COLLECTING → COMPLETED → REJECTED
  wa_chat_id text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Every WhatsApp message in and out
create table messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  role text not null, -- 'agent' | 'business'
  content text not null,
  created_at timestamp default now()
);

-- Jobs collected through WhatsApp conversation
create table jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id),
  title text,
  description text,
  salary text,
  employment_type text, -- 'full' | 'part' | 'gig'
  requirements text,
  location text default 'Актау',
  status text default 'active',
  created_at timestamp default now()
);

-- Job seekers registered via the platform
create table applicants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text unique not null,
  skills text,
  experience text,        -- '0-1 лет' | '1-3 лет' | '3+ лет'
  employment_type text,   -- 'full' | 'part' | 'gig'
  district text,
  bio text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Job applications submitted through the platform
create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  applicant_id uuid references applicants(id),
  cover_message text,
  status text default 'pending', -- 'pending' | 'viewed' | 'accepted' | 'rejected'
  created_at timestamp default now(),
  unique(job_id, applicant_id)   -- one application per job per applicant
);
```

*Note: Supabase Realtime must be enabled on the `businesses` and `jobs` tables to power the live dashboard.*

## Project Structure
```
/
├── server/
│   ├── index.js              # Express app entry point & routes
│   ├── supabase.js           # Supabase client singleton
│   ├── scraper.js            # 2GIS Playwright scraper
│   ├── agent.js              # Core agent loop (ties components together)
│   ├── gemini.js             # Gemini conversation engine & JSON extraction
│   ├── match.js              # Gemini-powered AI job matching for applicants
│   ├── whatsapp.js           # whatsapp-web.js client + sender
│   ├── logger.js             # SSE log streaming
│   └── routes/
│       ├── scrape.js         # POST /api/scrape — trigger 2GIS scraper
│       ├── businesses.js     # GET /api/businesses — list businesses
│       ├── jobs.js           # GET /api/jobs, /api/jobs/categories, /api/jobs/:id
│       ├── applicants.js     # POST/GET/PATCH /api/applicants — upsert by phone
│       ├── applications.js   # POST/GET/PATCH /api/applications — job applications
│       └── match.js          # POST /api/match/jobs — AI job matching
├── client/
│   ├── index.html            # Two-panel control center dashboard
│   │                         # Left: searchable selectable business list + Run Scraper + Contact All
│   │                         # Right: Agent monitor — live SSE feed + extracted job data + buttons
│   └── platform/             # React + Vite job platform SPA
│       ├── src/
│       │   ├── main.jsx
│       │   ├── App.jsx       # Router: /, /job/:id, /profile, /employer
│       │   ├── api.js        # All fetch helpers (jobs, applicants, applications, match)
│       │   ├── pages/
│       │   │   ├── JobBoard.jsx   # Home — search, filter, AI match, job grid
│       │   │   ├── JobDetail.jsx  # Single job — details + apply button
│       │   │   ├── Profile.jsx    # Applicant profile + my applications
│       │   │   └── Employer.jsx   # Business search + applicant management
│       │   └── components/
│       │       ├── FilterBar.jsx  # Employment type / category / district filters
│       │       ├── JobCard.jsx    # Job card with optional AI match reason
│       │       ├── ApplyModal.jsx # Apply-to-job modal (creates application)
│       │       └── MatchModal.jsx # AI match modal (calls /api/match/jobs)
│       ├── vite.config.js    # base: '/platform/', proxy /api → localhost:4242
│       └── dist/             # Built output served by Express at /platform/
├── .env
└── package.json
```

## Dev Servers
- **Express API + Control Center:** `node server/index.js` → http://localhost:4242
- **React platform (dev):** `cd client/platform && npm run dev` → http://localhost:5173/platform/
- **Vite proxy:** all `/api` calls from the React dev server are proxied to `localhost:4242`
- **Production:** `npm run build` in `client/platform/`, then Express serves the `dist/` folder at `/platform/`

## Core Agent Logic

### The State Machine
```
DISCOVERED → CONTACTED → INTERESTED → COLLECTING → COMPLETED
                                                 → REJECTED
```
Every incoming WhatsApp message runs through `processIncomingMessage()` in `agent.js`.
State transitions happen by updating `businesses.status` in Supabase.
Supabase Realtime broadcasts the change → dashboard updates automatically.

### First Message Personalization (`gemini.js`)
The first WhatsApp message is AI-generated via `generateFirstMessage(business)` — not hardcoded.
- Uses a Gemini `systemInstruction` defining the Алихан HR-assistant persona and a strict Russian message template
- Fills `[Название]` (business name), `[Категория]` (category), and `[Профессия]` (profession inferred from category, e.g. кафе → официантов/поваров, СТО → автомехаников)
- Falls back to a minimal template string if Gemini fails (network/quota errors)
- Returns plain text (no JSON); uses the same API key rotation logic as `processMessage()`

### The Central Function (`agent.js`)
1. Load business + full message history + current job (if any) from Supabase.
2. Save incoming message to `messages` table (`role: 'business'`).
3. Call Gemini with history + system prompt.
4. Gemini returns structured JSON (intent, extracted fields, next message, next state).
5. Update `business.status` in Supabase.
6. Upsert extracted job data into `jobs` table.
7. Save agent reply to `messages` table (`role: 'agent'`).
8. Send `next_message` via `whatsapp-web.js`.

### Gemini Output Format (`gemini.js`)
*Note: `generateFirstMessage()` returns plain text (not JSON) — the JSON format below applies only to `processMessage()` (ongoing conversation turns).*

The prompt instructs the AI to be a friendly HR assistant ("Алихан") collecting `title`, `salary`, `employment_type`, and `requirements`. It must respond ONLY in this JSON format:
```json
{
  "intent": "interested" | "not_interested" | "provided_info" | "unclear",
  "extracted": {
    "title": "string | null",
    "salary": "string | null",
    "employment_type": "\"full\" | \"part\" | \"gig\" | null",
    "requirements": "string | null"
  },
  "next_message": "string",
  "next_state": "INTERESTED | COLLECTING | COMPLETED | REJECTED",
  "collection_complete": true/false
}
```

## AI Job Matching (`server/match.js`)
`matchJobsForApplicant(applicant, jobs)` sends an applicant profile + up to 50 active jobs to Gemini
and gets back a ranked list of the top 5 matches (score ≥ 5).

- Called via `POST /api/match/jobs` — body: `{ applicant_id }` OR `{ skills, experience, employment_type, district }`
- Returns: `{ matches: [{ job_id, score, reason, job }] }` sorted by score descending
- Uses same key rotation + retry logic as `gemini.js`
- UI entry points: MatchModal on JobBoard, "Find matches" button on Profile page

## Platform API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/jobs` | List active jobs; query params: `search`, `employment_type`, `category`, `district`, `limit`, `offset` |
| GET | `/api/jobs/categories` | Distinct business categories that have active jobs |
| GET | `/api/jobs/:id` | Single job with business details |
| POST | `/api/applicants` | Create or update applicant (upsert by phone) |
| GET | `/api/applicants/:id` | Get applicant by UUID |
| GET | `/api/applicants/by-phone/:phone` | Get applicant by phone number |
| PATCH | `/api/applicants/:id` | Update applicant fields |
| POST | `/api/applications` | Submit a job application (409 if duplicate) |
| GET | `/api/applications/by-applicant/:id` | All applications for an applicant (with job + business) |
| GET | `/api/applications/by-business/:id` | All applications across a business's jobs (with applicant) |
| PATCH | `/api/applications/:id` | Update application status |
| POST | `/api/match/jobs` | AI-powered job matching |

## Applicant Identity (localStorage)
The platform has no auth. Applicant identity is stored in `localStorage` under `wg_applicant`:
```json
{ "id": "uuid", "name": "Айдар", "phone": "87001234567" }
```
Set on profile save (`createOrUpdateApplicant`). Used by Profile and ApplyModal to pre-fill forms
and load the applicant's applications.

## 2GIS Scraper (`scraper.js`)
Searches categories (e.g., "кафе Актау") in 2GIS using a headless Playwright browser.
Extracts name, phone, address, and category.
Saves to `businesses` table with status `DISCOVERED` (skipping duplicates).

## SSE Event Types (`logger.js`)
Every agent action emits a structured SSE event with `{ msg, type, businessId, data }`.
The control center dashboard color-codes events by type:

| Type | Color | Description |
|------|-------|-------------|
| `wa_in` | amber | Incoming WhatsApp message from business |
| `wa_out` | blue | Outgoing WhatsApp message from agent |
| `gemini_req` | teal | Gemini API call context (business, missing fields) |
| `gemini_res` | emerald | Parsed Gemini JSON response |
| `state` | indigo | Business status transition (e.g. DISCOVERED → CONTACTED) |
| `db` | purple | Database write operation |
| `success` | green | Completion events |
| `error` | red | Errors |
| `system` | gray | System/info messages |
| `scraper` | cyan | 2GIS scraper events |

## Critical Rules
- **No in-memory state:** Every state change must hit Supabase.
- **WhatsApp runs locally:** `whatsapp-web.js` requires a local Chrome instance. The server must run locally to scan the QR code via terminal or the `/qr` page.
- **Gemini strictness:** `processMessage()` must only output valid JSON. `generateFirstMessage()` returns plain text. The app handles key rotation for reliability.
- **Supabase Realtime:** Must be enabled on both `businesses` AND `jobs` tables for the control center dashboard to update live.
- **Vite proxy must target port 4242:** `vite.config.js` proxy `/api` → `http://localhost:4242`. If the server port changes, update both `.env` (PORT) and `vite.config.js`.
