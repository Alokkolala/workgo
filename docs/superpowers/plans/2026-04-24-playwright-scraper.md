# Playwright 2GIS Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Playwright scraper that searches 2GIS Aktau by category, extracts business name/phone/address, saves to Supabase `businesses` table with status `DISCOVERED`, exposed via `POST /api/scrape`.

**Architecture:** Playwright headless browser navigates `https://2gis.kz/aktau/search/{query}`, clicks "show phone" buttons to reveal numbers, collects up to 20 businesses across 5 categories, bulk-inserts into Supabase skipping duplicates by phone. Express route triggers the scraper and returns `{ count }`.

**Tech Stack:** Node.js, Express, Playwright (`playwright`), `@supabase/supabase-js`, `dotenv`

---

## File Map

| File | Role |
|---|---|
| `package.json` | Dependencies + start script |
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `server/supabase.js` | Supabase client singleton |
| `server/scraper.js` | Playwright scrape logic |
| `server/routes/scrape.js` | `POST /api/scrape` handler |
| `server/index.js` | Express app, mounts routes |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.env`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "workgo",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "playwright": "^1.44.0"
  }
}
```

- [ ] **Step 2: Create `.env`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 3: Install dependencies**

```bash
npm install
npx playwright install chromium
```

Expected: `node_modules/` created, chromium browser downloaded.

- [ ] **Step 4: Commit**

```bash
git add package.json .env
git commit -m "chore: scaffold project with dependencies"
```

---

### Task 2: Supabase client singleton

**Files:**
- Create: `server/supabase.js`

- [ ] **Step 1: Create `server/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

if (!process.env.SUPABASE_URL) throw new Error('Missing SUPABASE_URL')
if (!process.env.SUPABASE_ANON_KEY) throw new Error('Missing SUPABASE_ANON_KEY')

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)
```

- [ ] **Step 2: Smoke-test the client**

```bash
node -e "import('./server/supabase.js').then(m => m.supabase.from('businesses').select('count').then(r => console.log('OK', r)))"
```

Expected: `OK { data: [...], error: null, ... }` — no auth error.  
If you get `relation "businesses" does not exist`: run the schema SQL in the Supabase dashboard first (from CLAUDE.md).

- [ ] **Step 3: Commit**

```bash
git add server/supabase.js
git commit -m "feat: add supabase client singleton"
```

---

### Task 3: Playwright scraper

**Files:**
- Create: `server/scraper.js`

The scraper navigates 2GIS search, waits for business cards to load, clicks each "show phone" button, and extracts data. It targets 4 businesses per category across 5 categories = ~20 total.

- [ ] **Step 1: Create `server/scraper.js`**

```js
import { chromium } from 'playwright'
import { supabase } from './supabase.js'

const CATEGORIES = [
  'кафе Актау',
  'магазин Актау',
  'автосервис Актау',
  'салон красоты Актау',
  'строительная компания Актау',
]

const PER_CATEGORY = 4

/**
 * Scrape one search query from 2GIS.
 * Returns array of { name, phone, address, category }.
 */
async function scrapeCategory(page, query) {
  const encoded = encodeURIComponent(query)
  await page.goto(`https://2gis.kz/aktau/search/${encoded}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  // Wait for at least one business card
  await page.waitForSelector('[class*="_name_"]', { timeout: 15000 }).catch(() => null)

  const results = []

  const cards = await page.$$('[class*="_item_"]')
  const target = cards.slice(0, PER_CATEGORY)

  for (const card of target) {
    try {
      // Extract name
      const nameEl = await card.$('[class*="_name_"]')
      const name = nameEl ? (await nameEl.innerText()).trim() : null
      if (!name) continue

      // Extract address
      const addrEl = await card.$('[class*="_address_"]')
      const address = addrEl ? (await addrEl.innerText()).trim() : null

      // Click "show phone" button if present
      const phoneBtn = await card.$('[class*="_phoneButton_"], [class*="_showPhone_"]')
      let phone = null
      if (phoneBtn) {
        await phoneBtn.click()
        await page.waitForTimeout(800)
        const phoneEl = await card.$('[class*="_phone_"] a, [href^="tel:"]')
        if (phoneEl) {
          phone = (await phoneEl.innerText()).trim().replace(/\s+/g, '')
        }
      }

      results.push({
        name,
        phone,
        address,
        category: query.split(' ')[0], // e.g. "кафе"
      })
    } catch (_) {
      // skip malformed card
    }
  }

  return results
}

/**
 * Run full scrape across all categories.
 * Saves new businesses to Supabase, skips duplicates by phone.
 * Returns count of newly inserted rows.
 */
export async function runScraper() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  // Block images/fonts to speed up loading
  await page.route('**/*.{png,jpg,jpeg,gif,webp,woff,woff2}', r => r.abort())

  const allResults = []

  for (const query of CATEGORIES) {
    console.log(`Scraping: ${query}`)
    try {
      const businesses = await scrapeCategory(page, query)
      console.log(`  Found ${businesses.length} businesses`)
      allResults.push(...businesses)
    } catch (err) {
      console.error(`  Failed for "${query}":`, err.message)
    }
  }

  await browser.close()

  if (allResults.length === 0) return 0

  // Upsert — skip duplicates by phone (null phones always insert)
  const rows = allResults.map(b => ({
    name: b.name,
    phone: b.phone || null,
    category: b.category,
    address: b.address || null,
    status: 'DISCOVERED',
  }))

  const { data, error } = await supabase
    .from('businesses')
    .insert(rows, { ignoreDuplicates: true })
    .select('id')

  if (error) throw new Error(`Supabase insert failed: ${error.message}`)

  return data.length
}
```

- [ ] **Step 2: Smoke-test the scraper standalone**

```bash
node -e "import('./server/scraper.js').then(m => m.runScraper()).then(n => console.log('Inserted:', n)).catch(console.error)"
```

Expected: logs like `Scraping: кафе Актау` ... `Inserted: 12` (number varies).  
If 0 inserted but businesses logged: selector mismatch — inspect `https://2gis.kz/aktau/search/кафе%20Актау` in a browser, find the actual card class names, update `[class*="_item_"]` and `[class*="_name_"]` in `scraper.js`.

- [ ] **Step 3: Commit**

```bash
git add server/scraper.js
git commit -m "feat: playwright 2gis scraper with supabase insert"
```

---

### Task 4: POST /api/scrape route

**Files:**
- Create: `server/routes/scrape.js`

- [ ] **Step 1: Create `server/routes/scrape.js`**

```js
import { Router } from 'express'
import { runScraper } from '../scraper.js'

const router = Router()

router.post('/', async (req, res) => {
  try {
    const count = await runScraper()
    res.json({ ok: true, count })
  } catch (err) {
    console.error('Scrape error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

export default router
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/scrape.js
git commit -m "feat: POST /api/scrape route"
```

---

### Task 5: Express server

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Create `server/index.js`**

```js
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import scrapeRouter from './routes/scrape.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use('/api/scrape', scrapeRouter)

app.get('/health', (_, res) => res.json({ ok: true }))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
```

- [ ] **Step 2: Add `cors` to package.json and install**

```bash
npm install cors
```

- [ ] **Step 3: Start the server**

```bash
npm run dev
```

Expected: `Server running on http://localhost:3000`

- [ ] **Step 4: Test the endpoint**

```bash
curl -X POST http://localhost:3000/api/scrape
```

Expected:
```json
{ "ok": true, "count": 15 }
```

Check Supabase dashboard → Table Editor → `businesses` — rows should appear with `status = DISCOVERED`.

- [ ] **Step 5: Commit**

```bash
git add server/index.js package.json package-lock.json
git commit -m "feat: express server with /api/scrape endpoint"
```

---

## Selector Fallback Guide

If `scrapeCategory` returns 0 results, 2GIS may have updated their CSS class names. Debug steps:

1. Run a headed browser to inspect: change `headless: true` → `headless: false` in `scraper.js`
2. Open `https://2gis.kz/aktau/search/кафе%20Актау` manually
3. Right-click a business card → Inspect → find the wrapping `div` class
4. Update these selectors in `scrapeCategory`:
   - Card container: `[class*="_item_"]`
   - Business name: `[class*="_name_"]`
   - Address: `[class*="_address_"]`
   - Phone button: `[class*="_phoneButton_"]`

2GIS uses CSS modules so class names contain a stable semantic prefix (e.g. `_name_`) even when the hash suffix changes. The `[class*=]` attribute selector handles this.
