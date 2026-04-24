# Mangystau Jobs Platform — Claude Code Instructions

## What We're Building
An AI-powered employment platform for Aktau, Kazakhstan targeting youth and small businesses.
The unique differentiator: an autonomous agent that scrapes businesses from 2GIS, contacts them
via WhatsApp, and collects job postings through a multi-turn AI conversation — populating the
platform with real employer data during the live demo.

## Stack
- **Runtime:** Node.js + Express
- **Database:** Supabase (Postgres + Realtime)
- **AI:** Google Gemini 2.5 Flash (`@google/generative-ai`)
- **Scraping:** Playwright
- **WhatsApp:** whatsapp-web.js
- **Telegram:** telegraf
- **Frontend:** React (Vite) or plain HTML — keep it minimal
- **Deploy:** Railway (backend) + Vercel (frontend) or Railway for both

## Environment Variables
```
SUPABASE_URL=https://yjfwlgerugzgjebfwrnl.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZndsZ2VydWd6Z2plYmZ3cm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTYyOTMsImV4cCI6MjA5MjU5MjI5M30.GcPjlptE6LcDoz9iPJjMiu4RFADu8mTcLNIX4Eq1RH4
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZndsZ2VydWd6Z2plYmZ3cm5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAxNjI5MywiZXhwIjoyMDkyNTkyMjkzfQ.5FSr1WxVeHk5qwMdwwbexKL5xMFOyGfLKZVPCW0oVq4
GEMINI_API_KEY=
TELEGRAM_BOT_TOKEN=
PLATFORM_URL=https://your-deployed-url.com
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

-- Candidates (job seekers)
create table candidates (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text,
  skills text[],
  location text,
  availability text, -- 'full' | 'part' | 'gig'
  telegram_id text,
  created_at timestamp default now()
);

-- Applications
create table applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references jobs(id),
  candidate_id uuid references candidates(id),
  status text default 'pending',
  created_at timestamp default now()
);
```

Enable Supabase Realtime on the `businesses` and `jobs` tables.

## Project Structure
```
/
├── server/
│   ├── index.js              # Express app entry point
│   ├── supabase.js           # Supabase client singleton
│   ├── scraper.js            # 2GIS Playwright scraper
│   ├── agent.js              # Core agent loop
│   ├── gemini.js             # Gemini conversation engine
│   ├── whatsapp.js           # whatsapp-web.js client + sender
│   ├── telegram.js           # Telegraf bot
│   └── routes/
│       ├── scrape.js         # POST /api/scrape
│       ├── jobs.js           # CRUD for jobs
│       ├── candidates.js     # CRUD for candidates
│       ├── match.js          # POST /api/match
│       └── dashboard.js      # GET /api/dashboard/stats
├── client/
│   ├── index.html            # Dashboard UI
│   └── dashboard.js          # Supabase Realtime subscription
├── CLAUDE.md
├── .env
└── package.json
```

## Core Agent Logic

### The State Machine
```
DISCOVERED → CONTACTED → INTERESTED → COLLECTING → COMPLETED
                                                 → REJECTED
```
Every incoming WhatsApp message runs through `processIncomingMessage()`.
State transitions happen by updating `businesses.status` in Supabase.
Supabase Realtime broadcasts the change → dashboard updates automatically.

### The Central Function (agent.js)
```javascript
async function processIncomingMessage(businessId, incomingText) {
  // 1. Load business + full message history from Supabase
  // 2. Save incoming message to messages table (role: 'business')
  // 3. Call Gemini with history + system prompt → get JSON response
  // 4. Update business.status in Supabase
  // 5. If extracted job data → upsert into jobs table
  // 6. Save agent reply to messages table (role: 'agent')
  // 7. Send next_message via whatsapp-web.js
  // 8. If collection_complete → set status = COMPLETED
}
```

### Gemini System Prompt (gemini.js)
```
You are a friendly HR assistant for a free job platform in Aktau, Kazakhstan.
You are collecting job vacancy details from a small business owner via WhatsApp.
Communicate in Russian. Be casual, short, and friendly.



Current business state: {state}
Collected fields so far: {collected}
Missing fields: {missing}

Conversation history:
{history}

Latest message from business owner: "{message}"

Your tasks:
1. Parse their intent
2. Extract any job data from their message
3. Generate the next message to send
4. Decide the next state

Required job fields to collect: title, salary, employment_type, requirements

Respond ONLY in valid JSON, no other text:
{
  "intent": "interested" | "not_interested" | "provided_info" | "unclear",
  "extracted": {
    "title": string | null,
    "salary": string | null,
    "employment_type": "full" | "part" | "gig" | null,
    "requirements": string | null
  },
  "next_message": string,
  "next_state": "INTERESTED" | "COLLECTING" | "COMPLETED" | "REJECTED",
  "collection_complete": boolean
}
```

## 2GIS Scraper (scraper.js)

Search categories (in this order):
- кафе Актау
- магазин Актау  
- автосервис Актау
- салон красоты Актау
- строительная компания Актау

Target: 15-20 businesses per scrape run. Extract: name, phone, address, category.
Save to `businesses` table with status `DISCOVERED`.
After saving, immediately trigger `contactBusiness()` for each new business.

2GIS URL pattern: `https://2gis.kz/aktau/search/{query}`
Extract business cards from the search results page.
Phone numbers are behind a "show number" click — handle this.

## WhatsApp Agent First Message (Russian)
```
Ты — вежливый и профессиональный HR-ассистент по имени Алихан. Твоя задача — составить первое сообщение в WhatsApp для владельца бизнеса в Актау. Твое сообщение должно строго следовать этому шаблону:«Добрый день! Это Айдар, представитель новой платформы занятости Мангистау. Мы разрабатываем этот проект совместно с Акиматом, чтобы поддержать малый бизнес нашего города. Я увидел ваш бизнес [Название] на 2GIS и заметил, что вы работаете в сфере [Категория]. Мы автоматизируем поиск кадров специально для таких компаний в Актау. Если вы начнете сотрудничать с нами сейчас, на этапе запуска, мы гарантируем, что сервис останется для вас бесплатным навсегда, и мы будем поддерживать ваш проект лично.Подскажите, есть ли у вас сейчас открытые вакансии для [Профессия в множ. числе] или других сотрудников? Буду рад помочь вам быстро закрыть позицию!»ПРАВИЛА ПЕРСОНАЛИЗАЦИИ:1. [Название]: Используй название бизнеса, предоставленное пользователем.2. [Категория]: Используй сферу деятельности (например: кафе, салон красоты, СТО).3. [Профессия в множ. числе]: Самый важный пункт. На основе категории подбери логичную профессию.    - Если это кафе -> напиши "бариста или официантов".   - Если это магазин -> напиши "продавцов или кассиров".   - Если это СТО -> напиши "мастеров или механиков".   - Если категория общая -> напиши "специалистов".Тон: Официально-дружелюбный, без лишней "роботизированности". Язык: Русский.Выдавай ТОЛЬКО текст сообщения, без лишних комментариев.
```

## AI Matching Endpoint (routes/match.js)

`POST /api/match`
Input: `{ skills: string[], location: string, availability: string }`

- Query all active jobs from Supabase
- For each job, call Gemini to score the match 0-10
- Return top 5 ranked results with score + reason in Russian

## Real-time Dashboard (client/)

Subscribe to Supabase Realtime on `businesses` table.
Show live stats: discovered / contacted / interested / completed / rejected counts.
Show a live feed of businesses with their current status and last message snippet.
Add a "🚀 Run Agent" button that calls `POST /api/scrape`.
Keep the UI minimal — judges care about the data, not the design.

Use Tailwind CDN for styling. No build step for the dashboard.

## Telegram Bot (telegram.js)

When a new job is inserted into `jobs` table:
- Notify subscribed candidates via Telegram
- Message format: "🆕 Новая вакансия: {title} в {business.name}. Зарплата: {salary}. Откликнуться: {platform_url}/jobs/{id}"

Allow candidates to subscribe with `/start` command. Store `telegram_id` in candidates table.

## Build Order — Do Not Deviate
1. Supabase schema (run SQL above in Supabase dashboard first)
2. `server/supabase.js` — client singleton
3. `server/index.js` — Express skeleton with CORS
4. `server/scraper.js` + `routes/scrape.js` — test with one category
5. `server/gemini.js` — processMessage function, test in isolation
6. `server/whatsapp.js` — QR scan, send + receive messages
7. `server/agent.js` — ties scraper + gemini + whatsapp together
8. `client/index.html` + `client/dashboard.js` — Realtime dashboard
9. `server/telegram.js` — job notifications
10. `routes/match.js` — AI matching for candidates
11. Candidate-facing UI — lowest priority

## Demo Flow (Pitch Day)
1. Judge presses "🚀 Run Agent" on dashboard
2. Scraper finds 15-20 businesses from 2GIS (visible in real-time)
3. Agent sends WhatsApp messages to all of them
4. Show pre-seeded conversation where a business already replied → job appears
5. Show AI matching: candidate profile → ranked job list with scores
6. Show Telegram notification arriving

## Critical Rules
- Every user action must hit Supabase — no in-memory state
- Gemini responses must always be parsed as JSON — wrap in try/catch
- If WhatsApp session drops — have a fallback: show pre-recorded demo conversation
- whatsapp-web.js runs on your LAPTOP, not Railway — keep this local during demo
- Deploy everything else to Railway — one `railway up` command
- No auth system — single hardcoded admin token is fine
- No tests — ship, don't test
- No CSS polish — Tailwind utility classes only
