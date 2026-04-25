# Telegram Bot + Employer AI Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Telegram bot for job seekers (browse jobs, quick apply, receive notifications) and AI-powered candidate matching for employers — completing the two missing MVP requirements.

**Architecture:** A `server/telegram.js` module initializes a Telegraf bot in the same Express process. Notifications are fired from existing route handlers (applications PATCH/POST) and from agent.js on job completion. The employer AI matching adds one backend endpoint and augments the existing Employer page with a jobs panel + match modal.

**Tech Stack:** Node.js ESM, Telegraf v4, Supabase, Gemini (existing key rotation), React + Tailwind CDN (existing)

---

## File Map

**New files:**
- `server/telegram.js` — Telegraf bot: commands, callbacks, exported notification helpers
- `server/routes/candidateMatch.js` — `POST /api/match/candidates` route

**Modified files:**
- `server/index.js:203` — call `initTelegramBot()` on boot (non-blocking)
- `server/agent.js:175` — call `notifyNewJobToSubscribers()` when `collection_complete = true`
- `server/routes/applications.js:23` — call `notifyEmployerNewApplication()` after POST insert
- `server/routes/applications.js:72` — call `notifyApplicantStatusChange()` after PATCH update
- `server/match.js` — add `matchCandidatesForJob(job, applicants)` export
- `server/routes/jobs.js` — add `GET /api/jobs/by-business/:businessId` endpoint
- `client/platform/src/api.js` — add `getJobsByBusiness(id)` and `matchCandidates(jobId)`
- `client/platform/src/pages/Employer.jsx` — add jobs panel + AI candidate match UI
- `.env` — add `TELEGRAM_BOT_TOKEN`

---

## Task 1: Install telegraf and scaffold server/telegram.js

**Files:**
- Create: `server/telegram.js`
- Modify: `.env`

- [ ] **Step 1: Install telegraf**

```bash
npm install telegraf
```

Expected output: `added N packages`

- [ ] **Step 2: Add TELEGRAM_BOT_TOKEN to .env**

Open `.env` and add:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

Get a token from @BotFather on Telegram: `/newbot` → follow prompts → copy the token.

- [ ] **Step 3: Create server/telegram.js with skeleton**

```javascript
import { Telegraf, Markup } from 'telegraf'
import { supabase } from './supabase.js'
import { log } from './logger.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
let bot = null

// In-memory state for multi-step conversations: { telegramId: 'awaiting_employer_name' }
const pendingState = new Map()

export function isTelegramEnabled() {
  return !!BOT_TOKEN
}

export async function initTelegramBot() {
  if (!BOT_TOKEN) {
    log('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled', 'system')
    return
  }

  bot = new Telegraf(BOT_TOKEN)

  bot.start(handleStart)
  bot.on('contact', handleContact)
  bot.command('jobs', handleJobs)
  bot.command('myapps', handleMyApps)
  bot.command('employer', handleEmployerLink)
  bot.on('text', handleText)
  bot.action(/^apply_(.+)$/, handleApplyCallback)

  bot.launch()
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
  log('Telegram bot started', 'success')
}

// ── Command handlers (implemented in Tasks 3–6) ───────────────────

async function handleStart(ctx) {
  const telegramId = ctx.from.id
  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (applicant) {
    return ctx.reply(
      `Привет, ${applicant.name}! 👋\n\n/jobs — вакансии\n/myapps — мои отклики`,
      Markup.removeKeyboard()
    )
  }

  return ctx.reply(
    'Привет! Я WorkGo — нахожу работу в Актау 🏙\n\nПоделись номером телефона, чтобы подключить аккаунт:',
    Markup.keyboard([[Markup.button.contactRequest('📱 Поделиться номером')]])
      .oneTime()
      .resize()
  )
}

async function handleContact(ctx) {
  const rawPhone = ctx.message.contact.phone_number.replace(/\D/g, '')
  const telegramId = ctx.from.id

  // Normalize to 8-prefix (KZ format used in the DB)
  let phone = rawPhone
  if (rawPhone.length === 11 && rawPhone.startsWith('7')) phone = '8' + rawPhone.slice(1)
  if (rawPhone.length === 12 && rawPhone.startsWith('77')) phone = '8' + rawPhone.slice(2)

  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle()

  if (!applicant) {
    return ctx.reply(
      `Профиль с номером ${phone} не найден.\n\nСоздай профиль на платформе, затем вернись и напиши /start`,
      Markup.removeKeyboard()
    )
  }

  await supabase.from('applicants').update({ telegram_id: telegramId }).eq('id', applicant.id)

  return ctx.reply(
    `✅ Аккаунт подключён! Привет, ${applicant.name}!\n\n/jobs — вакансии\n/myapps — отклики`,
    Markup.removeKeyboard()
  )
}

async function handleJobs(ctx) {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, businesses(name, address)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!jobs || jobs.length === 0) {
    return ctx.reply('Вакансий пока нет. Загляни позже!')
  }

  for (const job of jobs) {
    await ctx.reply(formatJobMessage(job), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback('Откликнуться 💼', `apply_${job.id}`)
      ])
    })
  }
}

async function handleMyApps(ctx) {
  const telegramId = ctx.from.id
  const { data: applicant } = await supabase
    .from('applicants')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (!applicant) return ctx.reply('Подключи аккаунт: /start')

  const { data: apps } = await supabase
    .from('applications')
    .select('status, created_at, jobs(title, businesses(name))')
    .eq('applicant_id', applicant.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!apps || apps.length === 0) return ctx.reply('Откликов нет. Смотри вакансии: /jobs')

  const STATUS = { pending: '⏳', viewed: '👁', accepted: '✅', rejected: '❌' }
  const lines = apps.map(a => {
    const title = a.jobs?.title || '?'
    const biz = a.jobs?.businesses?.name || '?'
    return `${STATUS[a.status] || '•'} ${title} — ${biz}`
  })
  return ctx.reply(`Твои отклики:\n\n${lines.join('\n')}`)
}

async function handleEmployerLink(ctx) {
  pendingState.set(ctx.from.id, 'awaiting_employer_name')
  return ctx.reply('Введи название своего бизнеса (как на 2GIS):')
}

async function handleText(ctx) {
  const state = pendingState.get(ctx.from.id)
  if (state === 'awaiting_employer_name') {
    pendingState.delete(ctx.from.id)
    const name = ctx.message.text.trim()
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(5)

    if (!businesses || businesses.length === 0) {
      return ctx.reply('Бизнес не найден. Убедись, что он добавлен на платформу.')
    }
    if (businesses.length === 1) {
      await supabase
        .from('businesses')
        .update({ telegram_id: ctx.from.id })
        .eq('id', businesses[0].id)
      return ctx.reply(`✅ Уведомления подключены для «${businesses[0].name}»!\nТеперь ты будешь получать сообщения о новых откликах.`)
    }
    // Multiple matches — show inline buttons to pick
    const buttons = businesses.map(b =>
      [Markup.button.callback(b.name, `link_biz_${b.id}`)]
    )
    return ctx.reply('Найдено несколько бизнесов. Выбери свой:', Markup.inlineKeyboard(buttons))
  }
}

// Callback: employer picks business from list
bot?.action(/^link_biz_(.+)$/, async (ctx) => {
  const bizId = ctx.match[1]
  await ctx.answerCbQuery()
  const { data: biz } = await supabase.from('businesses').select('name').eq('id', bizId).single()
  await supabase.from('businesses').update({ telegram_id: ctx.from.id }).eq('id', bizId)
  return ctx.reply(`✅ Уведомления подключены для «${biz?.name}»!`)
})

async function handleApplyCallback(ctx) {
  const jobId = ctx.match[1]
  const telegramId = ctx.from.id
  await ctx.answerCbQuery()

  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (!applicant) return ctx.reply('Сначала подключи аккаунт: /start')

  const { error } = await supabase
    .from('applications')
    .insert({ job_id: jobId, applicant_id: applicant.id, cover_message: 'Отклик через Telegram' })

  if (error) {
    if (error.code === '23505') return ctx.reply('Ты уже откликался на эту вакансию.')
    return ctx.reply('Ошибка при отклике. Попробуй на сайте.')
  }

  await notifyEmployerNewApplicationInternal(jobId, applicant.name)
  return ctx.reply('✅ Отклик отправлен!')
}

// ── Notification helpers ──────────────────────────────────────────

function formatJobMessage(job) {
  const biz = job.businesses || {}
  const TYPE = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
  return [
    `<b>${job.title || 'Вакансия'}</b>`,
    biz.name ? `🏢 ${biz.name}` : null,
    job.salary ? `💰 ${job.salary}` : null,
    job.employment_type ? `⏰ ${TYPE[job.employment_type] || job.employment_type}` : null,
    biz.address ? `📍 ${biz.address}` : null,
    job.requirements ? `\nТребования: ${job.requirements}` : null,
  ].filter(Boolean).join('\n')
}

async function notifyEmployerNewApplicationInternal(jobId, applicantName) {
  if (!bot) return
  const { data: job } = await supabase
    .from('jobs')
    .select('title, businesses(telegram_id, name)')
    .eq('id', jobId)
    .maybeSingle()

  const telegramId = job?.businesses?.telegram_id
  if (!telegramId) return

  await bot.telegram.sendMessage(
    telegramId,
    `📩 Новый отклик!\n\nВакансия: ${job.title || '?'}\nСоискатель: ${applicantName}`
  ).catch(() => {})
}

/**
 * Called from server/routes/applications.js PATCH handler.
 * Notifies applicant when employer changes application status.
 */
export async function notifyApplicantStatusChange(applicantId, jobTitle, newStatus) {
  if (!bot) return
  const { data: applicant } = await supabase
    .from('applicants')
    .select('telegram_id')
    .eq('id', applicantId)
    .maybeSingle()

  if (!applicant?.telegram_id) return

  const MSG = {
    viewed: '👁 Работодатель просмотрел твой отклик',
    accepted: '✅ Поздравляем! Работодатель принял тебя на работу',
    rejected: '❌ По этой вакансии получен отказ',
  }
  const text = MSG[newStatus]
  if (!text) return

  await bot.telegram.sendMessage(
    applicant.telegram_id,
    `📌 Обновление отклика\n\nВакансия: ${jobTitle}\n${text}`
  ).catch(() => {})
}

/**
 * Called from server/routes/applications.js POST handler (web applies).
 * Notifies employer when a new application arrives from the website.
 */
export async function notifyEmployerNewApplication(jobId, applicantName) {
  return notifyEmployerNewApplicationInternal(jobId, applicantName)
}

/**
 * Called from server/agent.js when collection_complete = true.
 * Broadcasts new job to all applicants who have linked Telegram.
 */
export async function notifyNewJobToSubscribers(job, businessName) {
  if (!bot) return

  const { data: applicants } = await supabase
    .from('applicants')
    .select('telegram_id, employment_type')
    .not('telegram_id', 'is', null)

  if (!applicants || applicants.length === 0) return

  // Filter: send to applicants whose preferred type matches (or they have no preference)
  const targets = job.employment_type
    ? applicants.filter(a => !a.employment_type || a.employment_type === job.employment_type)
    : applicants

  const TYPE = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
  const text = [
    `🔔 <b>Новая вакансия!</b>`,
    ``,
    `<b>${job.title || 'Вакансия'}</b>`,
    `🏢 ${businessName}`,
    job.salary ? `💰 ${job.salary}` : null,
    job.employment_type ? `⏰ ${TYPE[job.employment_type]}` : null,
    ``,
    `/jobs — смотреть все вакансии`,
  ].filter(s => s !== null).join('\n')

  for (const applicant of targets) {
    await bot.telegram.sendMessage(applicant.telegram_id, text, { parse_mode: 'HTML' }).catch(() => {})
  }

  // Mark job as notified to avoid re-sending
  await supabase
    .from('jobs')
    .update({ telegram_notified_at: new Date().toISOString() })
    .eq('id', job.id)
}
```

- [ ] **Step 4: Verify the file compiles (no syntax errors)**

```bash
node --input-type=module --eval "import './server/telegram.js'"
```

Expected: no output (imports resolve). If there's an error about `supabase.js`, that's fine at import time — it requires a running Supabase config. The important thing is no parse errors.

Actually this won't work without env vars. Instead verify syntax:
```bash
node --check server/telegram.js
```

Expected: exits 0, no output.

- [ ] **Step 5: Commit**

```bash
git add server/telegram.js package.json package-lock.json
git commit -m "feat(telegram): scaffold bot with all command handlers"
```

---

## Task 2: Database schema updates

**Files:** none (Supabase SQL editor)

Run each statement in the Supabase SQL editor (or via `supabase db push` if using migrations).

- [ ] **Step 1: Add telegram_id to applicants**

```sql
ALTER TABLE applicants ADD COLUMN IF NOT EXISTS telegram_id bigint;
CREATE INDEX IF NOT EXISTS applicants_telegram_id_idx ON applicants(telegram_id);
```

- [ ] **Step 2: Add telegram_id to businesses**

```sql
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS telegram_id bigint;
CREATE INDEX IF NOT EXISTS businesses_telegram_id_idx ON businesses(telegram_id);
```

- [ ] **Step 3: Add telegram_notified_at to jobs**

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS telegram_notified_at timestamptz;
```

- [ ] **Step 4: Verify columns exist**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('applicants', 'businesses', 'jobs')
  AND column_name IN ('telegram_id', 'telegram_notified_at')
ORDER BY table_name, column_name;
```

Expected: 3 rows — `applicants.telegram_id`, `businesses.telegram_id`, `jobs.telegram_notified_at`.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "docs: note DB migrations for telegram_id columns"
```

---

## Task 3: Wire telegram bot into Express server

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Read server/index.js lines 1-20 to find existing imports**

The import block already has `initWhatsApp` pattern. We'll follow the same pattern.

- [ ] **Step 2: Add telegram import and boot call to server/index.js**

After line 17 (`import matchRouter from './routes/match.js'`), add:

```javascript
import { initTelegramBot } from './telegram.js'
```

After line 210 (`log('WhatsApp unavailable — server running without WA.', 'warn')`), inside the boot section, add after the WhatsApp try/catch block but before the closing `})`:

Find this block (around line 202-212):
```javascript
const server = app.listen(PORT, async () => {
  log(`Server running on http://localhost:${PORT}`, 'success')
  log('Initialising WhatsApp…', 'system')
  try {
    await initWhatsApp()
    log('WhatsApp connected — engine ready.', 'success')
  } catch (err) {
    console.error('❌ WhatsApp init failed:', err.message)
    log('WhatsApp unavailable — server running without WA.', 'warn')
  }
})
```

Replace with:
```javascript
const server = app.listen(PORT, async () => {
  log(`Server running on http://localhost:${PORT}`, 'success')
  log('Initialising WhatsApp…', 'system')
  try {
    await initWhatsApp()
    log('WhatsApp connected — engine ready.', 'success')
  } catch (err) {
    console.error('❌ WhatsApp init failed:', err.message)
    log('WhatsApp unavailable — server running without WA.', 'warn')
  }

  // Telegram bot (optional — disabled if TELEGRAM_BOT_TOKEN not set)
  try {
    await initTelegramBot()
  } catch (err) {
    console.error('❌ Telegram bot init failed:', err.message)
    log('Telegram bot unavailable.', 'warn')
  }
})
```

- [ ] **Step 3: Start the server and verify the bot boots**

```bash
node server/index.js
```

Expected log line: `Telegram bot started` (if TELEGRAM_BOT_TOKEN is set) OR `TELEGRAM_BOT_TOKEN not set — Telegram bot disabled` (if not set yet).

- [ ] **Step 4: Verify /start command in Telegram**

Open Telegram, find your bot, send `/start`. Expected: welcome message with "Share phone number" keyboard button.

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat(telegram): wire bot init into server boot"
```

---

## Task 4: Hook notification: new job → subscribers

**Files:**
- Modify: `server/agent.js`

- [ ] **Step 1: Add import to agent.js**

Add to the top of `server/agent.js` after existing imports:

```javascript
import { notifyNewJobToSubscribers, isTelegramEnabled } from './telegram.js'
```

- [ ] **Step 2: Add notification call in processIncomingMessage**

In `server/agent.js`, find the `if (collection_complete)` block near line 175:

```javascript
  if (collection_complete) {
    log(`Job collection COMPLETE for: ${business.name}`, 'success', businessId)
  }
```

Replace with:

```javascript
  if (collection_complete) {
    log(`Job collection COMPLETE for: ${business.name}`, 'success', businessId)
    if (isTelegramEnabled() && hasExtracted) {
      // Re-fetch the job to get the full record after upsert
      const { data: finalJobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (finalJobs && finalJobs[0] && !finalJobs[0].telegram_notified_at) {
        notifyNewJobToSubscribers(finalJobs[0], business.name).catch(err =>
          log(`Telegram job notify error: ${err.message}`, 'warn', businessId)
        )
      }
    }
  }
```

- [ ] **Step 3: Test by triggering a debug reply**

With the server running and a business in COLLECTING state, use:

```bash
curl -s -X POST http://localhost:4242/api/debug/reply \
  -H "Content-Type: application/json" \
  -d '{"businessId":"<uuid>","message":"Нам нужен повар, зарплата 150000, полная занятость, опыт от 1 года"}'
```

Expected: any Telegram-linked applicants with matching employment_type receive a notification message. Server logs show `Telegram job notify` or no Telegram errors.

- [ ] **Step 4: Commit**

```bash
git add server/agent.js
git commit -m "feat(telegram): notify subscribers when new job collected"
```

---

## Task 5: Hook notification: application status change → applicant

**Files:**
- Modify: `server/routes/applications.js`

- [ ] **Step 1: Add import to applications.js**

Add at the top of `server/routes/applications.js`:

```javascript
import { notifyApplicantStatusChange, notifyEmployerNewApplication } from '../telegram.js'
```

- [ ] **Step 2: Hook status-change notification into PATCH handler**

Find the PATCH `/:id` route handler. After `res.json(data)` (the success response), add the notification. The full updated handler:

```javascript
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
    .select('applicant_id, jobs(title)')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)

  // Notify applicant via Telegram (fire and forget)
  const jobTitle = data.jobs?.title || 'Вакансия'
  notifyApplicantStatusChange(data.applicant_id, jobTitle, status).catch(() => {})
})
```

Note: the `.select('applicant_id, jobs(title)')` addition is required to get the job title for the notification message.

- [ ] **Step 3: Hook new-application notification into POST handler**

Find the POST `/` route handler. After `res.json(data)` (the success response), add:

```javascript
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
  const { data: applicant } = await supabase
    .from('applicants')
    .select('name')
    .eq('id', applicant_id)
    .maybeSingle()
  notifyEmployerNewApplication(job_id, applicant?.name || 'Соискатель').catch(() => {})
})
```

- [ ] **Step 4: Test status-change notification**

```bash
# Get an application ID from the DB, then:
curl -s -X PATCH http://localhost:4242/api/applications/<app-id> \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'
```

Expected: the applicant's Telegram (if telegram_id is set) receives "✅ Поздравляем!" message.

- [ ] **Step 5: Test new-application notification**

```bash
curl -s -X POST http://localhost:4242/api/applications \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<job-uuid>","applicant_id":"<applicant-uuid>","cover_message":"Хочу работать"}'
```

Expected: employer's Telegram (if telegram_id set on their business) receives "📩 Новый отклик!".

- [ ] **Step 6: Commit**

```bash
git add server/routes/applications.js
git commit -m "feat(telegram): notify on application create and status change"
```

---

## Task 6: /employer command — link business to Telegram

**Files:**
- Modify: `server/telegram.js`

The skeleton in Task 1 already includes the `handleEmployerLink`, `handleText`, and `link_biz_*` callback handler. However, the `bot?.action(...)` call at module level won't work because `bot` is null at module load time. Fix this by moving the `link_biz_*` callback registration inside `initTelegramBot`.

- [ ] **Step 1: Move link_biz callback into initTelegramBot**

Find this block in server/telegram.js (the standalone bot?.action call):
```javascript
// Callback: employer picks business from list
bot?.action(/^link_biz_(.+)$/, async (ctx) => {
  const bizId = ctx.match[1]
  await ctx.answerCbQuery()
  const { data: biz } = await supabase.from('businesses').select('name').eq('id', bizId).single()
  await supabase.from('businesses').update({ telegram_id: ctx.from.id }).eq('id', bizId)
  return ctx.reply(`✅ Уведомления подключены для «${biz?.name}»!`)
})
```

Remove it. Then inside `initTelegramBot`, after all the other `bot.action(...)` registrations, add:

```javascript
  bot.action(/^link_biz_(.+)$/, async (ctx) => {
    const bizId = ctx.match[1]
    await ctx.answerCbQuery()
    const { data: biz } = await supabase.from('businesses').select('name').eq('id', bizId).single()
    await supabase.from('businesses').update({ telegram_id: ctx.from.id }).eq('id', bizId)
    return ctx.reply(`✅ Уведомления подключены для «${biz?.name}»!`)
  })
```

- [ ] **Step 2: Verify /employer flow manually**

1. Send `/employer` to the bot in Telegram
2. Bot replies: "Введи название своего бизнеса"
3. Type a business name that exists in the DB
4. Bot links and confirms

- [ ] **Step 3: Verify via Supabase**

```sql
SELECT id, name, telegram_id FROM businesses WHERE telegram_id IS NOT NULL LIMIT 5;
```

Expected: at least one row with a non-null telegram_id.

- [ ] **Step 4: Commit**

```bash
git add server/telegram.js
git commit -m "fix(telegram): register link_biz callback inside initTelegramBot"
```

---

## Task 7: AI candidate matching — backend

**Files:**
- Modify: `server/match.js`
- Create: `server/routes/candidateMatch.js`
- Modify: `server/index.js`

- [ ] **Step 1: Add matchCandidatesForJob to server/match.js**

Add this function after the existing `matchJobsForApplicant` export:

```javascript
/**
 * Returns top matching applicants for a job posting.
 * @param {{ id, title, description, salary, employment_type, requirements }} job
 * @param {Array} applicants - applicant objects
 * @returns {Promise<Array<{ applicant_id, score, reason, applicant }>>}
 */
export async function matchCandidatesForJob(job, applicants) {
  if (!applicants.length) return []

  const prompt = `Ты — AI для подбора сотрудников на платформе занятости в Актау, Казахстан.

Вакансия:
- Должность: ${job.title || 'не указана'}
- Описание: ${job.description || 'нет'}
- Зарплата: ${job.salary || 'не указана'}
- Тип занятости: ${job.employment_type || 'любой'}
- Требования: ${job.requirements || 'не указаны'}

Список соискателей (JSON):
${JSON.stringify(applicants.map(a => ({
  id: a.id,
  skills: a.skills,
  experience: a.experience,
  employment_type: a.employment_type,
  district: a.district,
  bio: a.bio,
})))}

Верни ТОЛЬКО JSON-массив до 5 лучших кандидатов (score >= 5).
Формат: [{"applicant_id":"uuid","score":1-10,"reason":"краткое объяснение на русском"}]
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

  if (!raw) throw new Error(`Gemini candidate match failed: ${lastError?.message}`)

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const matches = JSON.parse(match[0])
    return matches
      .filter(m => applicants.find(a => a.id === m.applicant_id))
      .map(m => ({ ...m, applicant: applicants.find(a => a.id === m.applicant_id) }))
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Create server/routes/candidateMatch.js**

```javascript
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
```

- [ ] **Step 3: Mount the route in server/index.js**

Add import after existing match import (line ~17):
```javascript
import candidateMatchRouter from './routes/candidateMatch.js'
```

Add route after `/api/match`:
```javascript
app.use('/api/match', candidateMatchRouter)
```

- [ ] **Step 4: Test the endpoint**

First get a valid job_id from the DB, then:

```bash
curl -s -X POST http://localhost:4242/api/match/candidates \
  -H "Content-Type: application/json" \
  -d '{"job_id":"<valid-job-uuid>"}' | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); console.log(JSON.stringify(JSON.parse(d),null,2))"
```

Expected: `{ "matches": [ { "applicant_id": "...", "score": 8, "reason": "...", "applicant": {...} }, ... ] }`

- [ ] **Step 5: Commit**

```bash
git add server/match.js server/routes/candidateMatch.js server/index.js
git commit -m "feat(match): add AI candidate matching endpoint POST /api/match/candidates"
```

---

## Task 8: Jobs by business endpoint

**Files:**
- Modify: `server/routes/jobs.js`

The Employer page needs to list jobs for a selected business to show the AI match button per job.

- [ ] **Step 1: Add GET /api/jobs/by-business/:businessId to jobs.js**

Add before the `router.get('/:id', ...)` handler (must come before the generic `:id` catch-all):

```javascript
// GET /api/jobs/by-business/:businessId — all active jobs for a business
router.get('/by-business/:businessId', async (req, res) => {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, salary, employment_type, requirements, created_at')
    .eq('business_id', req.params.businessId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data || [])
})
```

- [ ] **Step 2: Test the endpoint**

```bash
curl -s "http://localhost:4242/api/jobs/by-business/<business-uuid>"
```

Expected: JSON array of job objects (may be empty if no active jobs for that business).

- [ ] **Step 3: Commit**

```bash
git add server/routes/jobs.js
git commit -m "feat(jobs): add GET /api/jobs/by-business/:businessId endpoint"
```

---

## Task 9: AI candidate matching — frontend

**Files:**
- Modify: `client/platform/src/api.js`
- Modify: `client/platform/src/pages/Employer.jsx`

- [ ] **Step 1: Add API helpers to api.js**

Add at the end of `client/platform/src/api.js`:

```javascript
// Employer tools
export const getJobsByBusiness = (businessId) =>
  fetch(`${BASE}/jobs/by-business/${businessId}`).then(r => r.json())

export const matchCandidates = (jobId) =>
  fetch(`${BASE}/match/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId })
  }).then(r => r.json())
```

- [ ] **Step 2: Update Employer.jsx imports**

Replace the existing import line:
```javascript
import { getBusinesses, getApplicationsByBusiness, updateApplicationStatus } from '../api.js'
```

With:
```javascript
import { getBusinesses, getApplicationsByBusiness, updateApplicationStatus, getJobsByBusiness, matchCandidates } from '../api.js'
```

- [ ] **Step 3: Add jobs state to Employer.jsx**

In the `Employer` function, after the existing state declarations, add:

```javascript
  const [jobs, setJobs] = useState([])
  const [matchResult, setMatchResult] = useState(null) // { jobTitle, matches }
  const [matchLoading, setMatchLoading] = useState(false)
```

- [ ] **Step 4: Fetch jobs when business is selected**

In the `selectBusiness` function, after `setApplications(...)`, add:

```javascript
    const jobList = await getJobsByBusiness(biz.id)
    setJobs(Array.isArray(jobList) ? jobList : [])
    setMatchResult(null)
```

- [ ] **Step 5: Add handleMatchCandidates function**

After the `changeStatus` function, add:

```javascript
  async function handleMatchCandidates(job) {
    setMatchLoading(job.id)
    const result = await matchCandidates(job.id)
    setMatchLoading(false)
    setMatchResult({ jobTitle: job.title, matches: result.matches || [] })
  }
```

- [ ] **Step 6: Add Jobs section + AI Match results to the JSX**

In the Employer.jsx JSX, after the closing `</>` of the `selectedBiz &&` block (but still inside that block), and before the `applications.map(...)` block, add the jobs panel. Replace the full `selectedBiz && (...)` JSX section with:

```jsx
        {selectedBiz && (
          <>
            {/* Jobs with AI match */}
            {jobs.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-3">Вакансии — {selectedBiz.name}</h2>
                {jobs.map(job => (
                  <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{job.title || 'Вакансия'}</p>
                      {job.salary && <p className="text-sm text-gray-500">{job.salary}</p>}
                    </div>
                    <button
                      onClick={() => handleMatchCandidates(job)}
                      disabled={matchLoading === job.id}
                      className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {matchLoading === job.id ? 'AI анализирует...' : '✨ AI подбор'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AI match results panel */}
            {matchResult && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-purple-800">AI: лучшие кандидаты на «{matchResult.jobTitle}»</h3>
                  <button onClick={() => setMatchResult(null)} className="text-purple-400 hover:text-purple-600 text-sm">✕</button>
                </div>
                {matchResult.matches.length === 0 && (
                  <p className="text-sm text-purple-600">Подходящих кандидатов не найдено. Добавьте больше соискателей.</p>
                )}
                {matchResult.matches.map((m, i) => {
                  const ap = m.applicant || {}
                  return (
                    <div key={m.applicant_id} className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{ap.name || 'Соискатель'}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {m.score}/10
                            </span>
                          </div>
                          {ap.skills && <p className="text-sm text-gray-600">Навыки: {ap.skills}</p>}
                          {ap.experience && <p className="text-xs text-gray-400">Опыт: {ap.experience}</p>}
                          <p className="text-xs text-purple-600 mt-1 italic">{m.reason}</p>
                        </div>
                        {ap.phone && (
                          <a href={`tel:${ap.phone}`} className="text-blue-600 text-sm font-semibold hover:underline shrink-0">
                            {ap.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Applications */}
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
```

- [ ] **Step 7: Build and verify**

```bash
cd client/platform && npm run build
```

Expected: build succeeds with no errors. Then start the server:
```bash
cd ../.. && node server/index.js
```

Open http://localhost:4242/platform/employer in the browser. Search for a business, select it. Verify:
- Jobs section appears with "✨ AI подбор" button per job
- Clicking the button shows a purple AI results panel with ranked candidates
- Applications section still appears and works

- [ ] **Step 8: Commit**

```bash
git add client/platform/src/api.js client/platform/src/pages/Employer.jsx client/platform/dist/
git commit -m "feat(employer): add jobs panel + AI candidate matching UI"
```

---

## Task 10: End-to-end smoke test

- [ ] **Step 1: Verify all notification paths**

Run this checklist manually:

| Action | Expected Telegram notification |
|--------|-------------------------------|
| Employer status → `accepted` on an application (applicant has telegram_id) | Applicant receives "✅ Поздравляем!" |
| Applicant submits application from web (employer has telegram_id) | Employer receives "📩 Новый отклик!" |
| Agent marks job `collection_complete` (applicants have telegram_id) | Applicants receive "🔔 Новая вакансия!" |
| `/jobs` in bot | Shows 5 latest active jobs with apply button |
| Tap "Откликнуться" in bot | Application created, employer notified |

- [ ] **Step 2: Verify AI candidate matching**

1. Go to `/platform/employer`
2. Search for a business with active jobs
3. Select it — jobs panel appears
4. Click "✨ AI подбор" on a job
5. Ranked candidates appear with scores and reasons

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete Telegram bot + employer AI candidate matching MVP"
```

---

## Self-Review: Spec Coverage

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| 01 — Real backend + DB | Express + Supabase (pre-existing) | ✅ |
| 02 — Live DB queries | All routes hit Supabase (pre-existing) | ✅ |
| 03 — AI matching (applicants) | `/api/match/jobs` + MatchModal (pre-existing) | ✅ |
| 03 — AI matching (employers) | `/api/match/candidates` + Employer.jsx panel | ✅ Task 7–9 |
| 04 — Telegram bot | server/telegram.js + bot commands | ✅ Tasks 1–6 |
| 04 — Telegram notifications | Hooks in agent.js + applications.js | ✅ Tasks 4–5 |
| 04 — Quick apply from bot | `apply_<jobId>` callback | ✅ Task 1 |
| 05 — Search + filters | FilterBar + `/api/jobs` params (pre-existing) | ✅ |
| 06 — Full apply flow | applications routes + Employer page (pre-existing) | ✅ |
