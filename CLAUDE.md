# Mangystau Jobs Platform — Claude Code Instructions

## What We're Building
An AI-powered employment platform for Aktau, Kazakhstan targeting youth and small businesses.
The unique differentiator: an autonomous agent that scrapes businesses from 2GIS, contacts them
via WhatsApp, and collects job postings through a multi-turn AI conversation — populating the
platform with real employer data.

## Stack
- **Runtime:** Node.js + Express
- **Database:** Supabase (Postgres + Realtime)
- **AI:** Google Gemini (using `@google/generative-ai`)
- **Scraping:** Playwright
- **WhatsApp:** whatsapp-web.js
- **Frontend:** HTML/JS Dashboard (minimal)

## Environment Variables
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=
GEMINI_API_KEY=
GEMINI_API_KEY_BACKUP_1= (optional)
GEMINI_API_KEY_BACKUP_2= (optional)
PORT=3000
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
│   ├── whatsapp.js           # whatsapp-web.js client + sender
│   ├── logger.js             # SSE log streaming
│   └── routes/
│       ├── scrape.js         # API for triggering scraper
│       └── businesses.js     # API for fetching business data
├── client/
│   └── index.html            # Dashboard UI & Realtime connection
├── .env
└── package.json
```

## Core Agent Logic

### The State Machine
```
DISCOVERED → CONTACTED → INTERESTED → COLLECTING → COMPLETED
                                                 → REJECTED
```
Every incoming WhatsApp message runs through `processIncomingMessage()` in `agent.js`.
State transitions happen by updating `businesses.status` in Supabase.
Supabase Realtime broadcasts the change → dashboard updates automatically.

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
The prompt instructs the AI to be a friendly HR assistant ("Alikhan") collecting `title`, `salary`, `employment_type`, and `requirements`. It must respond ONLY in this JSON format:
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

## 2GIS Scraper (`scraper.js`)
Searches categories (e.g., "кафе Актау") in 2GIS using a headless Playwright browser.
Extracts name, phone, address, and category.
Saves to `businesses` table with status `DISCOVERED` (skipping duplicates).

## Critical Rules
- **No in-memory state:** Every state change must hit Supabase.
- **WhatsApp runs locally:** `whatsapp-web.js` requires a local Chrome instance. The server must run locally to scan the QR code via terminal or the `/qr` page.
- **Gemini strictness:** The AI must only output valid JSON. The app handles key rotation for reliability.
