# WhatsApp Agent Conversation Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the WhatsApp agent hold a full multi-turn Russian conversation with a business, extract job vacancy fields (title, salary, employment_type, requirements), and persist them to Supabase — verified with a live test to `87072245669`.

**Architecture:** The existing agent loop (`agent.js → gemini.js → whatsapp.js → supabase`) is structurally complete but has a fragile Gemini JSON parser, a shallow system prompt that doesn't guide field collection, and no graceful recovery when Gemini fails. We fix those three things, add a phone-based contact endpoint for easy triggering, then run a live end-to-end test.

**Tech Stack:** Node.js ESM, Express, whatsapp-web.js, @google/generative-ai (Gemini 2.5 Flash), @supabase/supabase-js

---

## File Map

| File | Change |
|------|--------|
| `server/gemini.js` | Rewrite system prompt + add JSON parse recovery |
| `server/agent.js` | Add Gemini failure fallback message |
| `server/index.js` | Add `POST /api/contact-phone` endpoint |

---

### Task 1: Harden Gemini JSON parsing and improve system prompt

The current `processMessage` calls `JSON.parse(jsonText)` with no recovery — if Gemini wraps output in extra text or the JSON is malformed, the whole agent loop throws and the business never gets a reply.

Also the system prompt says "You are a friendly HR assistant" but gives Gemini no instruction about *how* to steer the conversation or what Russian phrasing to use.

**Files:**
- Modify: `server/gemini.js`

- [ ] **Step 1: Replace `server/gemini.js` with hardened version**

```javascript
import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

/**
 * Extract the first valid JSON object from a string.
 * Handles markdown code fences and leading/trailing prose.
 */
function extractJSON(raw) {
  // Strip markdown code fences
  let text = raw.replace(/^```json?\s*/im, '').replace(/\s*```$/m, '').trim()

  // Find first { ... } block
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response')
  return JSON.parse(text.slice(start, end + 1))
}

/**
 * @param {object} business      - row from businesses table
 * @param {Array}  history       - rows from messages table (sorted ASC)
 * @param {string} latestMessage - incoming text from the business owner
 * @param {object|null} currentJob - existing row from jobs table (or null)
 * @returns {Promise<{intent, extracted, next_message, next_state, collection_complete}>}
 */
export async function processMessage(business, history, latestMessage, currentJob) {
  const fields = ['title', 'salary', 'employment_type', 'requirements']

  const collected = fields
    .filter((f) => currentJob && currentJob[f])
    .map((f) => `${f}: ${currentJob[f]}`)
    .join(', ') || 'пока ничего'

  const missing = fields.filter((f) => !currentJob || !currentJob[f])
  const missingStr = missing.join(', ') || 'всё собрано'

  const historyText = (history || [])
    .map((m) => `${m.role === 'agent' ? 'Агент' : 'Владелец'}: ${m.content}`)
    .join('\n')

  const prompt = `Ты — дружелюбный HR-ассистент бесплатной платформы занятости для малого бизнеса в Актау, Казахстан.
Общаешься в WhatsApp с владельцем бизнеса. Пиши по-русски, коротко, разговорно, без формальностей.
Твоя задача — узнать детали вакансии в непринуждённой беседе. Задавай по ОДНОМУ вопросу за раз.
Не давай длинных объяснений. Если владелец не заинтересован — вежливо закончи разговор.

Бизнес: «${business.name}»
Текущий статус: ${business.status}
Уже собрано: ${collected}
Ещё нужно: ${missingStr}

История переписки:
${historyText || '(начало разговора)'}

Последнее сообщение от владельца: "${latestMessage}"

Нужные поля вакансии:
- title: название должности
- salary: зарплата (любой формат)
- employment_type: "full" (полная), "part" (частичная), "gig" (разовая)
- requirements: требования к кандидату

Если владелец говорит что вакансий нет — next_state: "REJECTED", collection_complete: false.
Если все 4 поля собраны — next_state: "COMPLETED", collection_complete: true.
Если часть полей собрана — next_state: "COLLECTING".
Если только выразил интерес — next_state: "INTERESTED".

Ответь ТОЛЬКО валидным JSON без какого-либо другого текста:
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
}`

  const result = await model.generateContent(prompt)
  const raw = result.response.text()
  return extractJSON(raw)
}
```

- [ ] **Step 2: Commit**

```bash
git add server/gemini.js
git commit -m "feat: harden Gemini JSON parsing + improve Russian system prompt"
```

---

### Task 2: Add Gemini failure fallback in agent.js

If `processMessage` throws (network error, quota, truly unparseable JSON), the business gets no reply and the conversation silently dies. Add a fallback that sends a neutral Russian message and keeps the current state.

**Files:**
- Modify: `server/agent.js` (lines 103–109)

- [ ] **Step 1: Wrap the Gemini call with a reply-on-error fallback**

Replace the existing Gemini section in `processIncomingMessage`:

```javascript
  // 5. Call Gemini
  let geminiResponse
  try {
    geminiResponse = await processMessage(business, history || [], incomingText, currentJob)
  } catch (err) {
    console.error(`Gemini error for "${business.name}":`, err.message)
    // Send a neutral fallback so the conversation doesn't go silent
    const fallback = 'Извините, у нас небольшие технические шалости 😅 Напишите чуть позже, разберёмся!'
    try { await sendMessage(business.phone, fallback) } catch (_) {}
    return
  }
```

- [ ] **Step 2: Commit**

```bash
git add server/agent.js
git commit -m "feat: send fallback message to business when Gemini fails"
```

---

### Task 3: Add POST /api/contact-phone endpoint

The existing `POST /api/contact/:id` requires knowing the Supabase UUID. For testing (and for future use), add an endpoint that accepts a phone number, looks up the business, and triggers `contactBusiness`.

**Files:**
- Modify: `server/index.js`

- [ ] **Step 1: Add the endpoint after the existing `/api/contact/:id` route**

```javascript
// POST /api/contact-phone — contact a business by phone number
// Body: { phone: "87072245669" }
app.post('/api/contact-phone', async (req, res) => {
  const { phone } = req.body
  if (!phone) return res.status(400).json({ ok: false, error: 'phone is required' })

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name, status')
    .eq('phone', phone)
    .limit(1)

  if (error) return res.status(500).json({ ok: false, error: error.message })
  if (!businesses || businesses.length === 0) {
    return res.status(404).json({ ok: false, error: `No business found with phone ${phone}` })
  }

  const business = businesses[0]
  res.json({ ok: true, message: `Contacting ${business.name}…`, id: business.id })
  contactBusiness(business.id).catch((err) =>
    console.error('contact-phone background error:', err)
  )
})
```

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat: add POST /api/contact-phone for easy testing"
```

---

### Task 4: Live end-to-end test

The test business `87072245669` is already seeded in Supabase as:
```json
{
  "id": "02071d5e-32e8-470f-b277-bb2273cdcdba",
  "name": "Тест Бизнес",
  "phone": "87072245669",
  "status": "DISCOVERED"
}
```

**Steps:**

- [ ] **Step 1: Start the server**

```bash
npm start
```

Expected output:
```
[success] Server running on http://localhost:4242
[system] Initialising WhatsApp…
📱 Scan QR below OR open http://localhost:4242/qr in browser:
[QR code appears here]
```

- [ ] **Step 2: Scan QR and wait for ready**

Open `http://localhost:4242/qr` in browser, scan with WhatsApp mobile.

Expected in terminal:
```
✅ WhatsApp client ready!
[success] WhatsApp connected — engine ready.
```

- [ ] **Step 3: Trigger first message to test business**

```bash
curl -s -X POST http://localhost:4242/api/contact-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"87072245669"}' | jq .
```

Expected response:
```json
{ "ok": true, "message": "Contacting Тест Бизнес…", "id": "02071d5e-..." }
```

Expected WhatsApp message delivered to `87072245669`:
```
Здравствуйте! Меня зовут Айдар, я представляю бесплатную платформу занятости для бизнесов Актау.
Увидел ваш бизнес «Тест Бизнес» на 2GIS. Помогаем быстро найти сотрудников — бесплатно.
У вас есть открытые вакансии? 🙂
```

- [ ] **Step 4: Reply from phone and watch agent respond**

Reply "Да, есть вакансия" from the `87072245669` device.

Expected in server terminal:
```
📥 Incoming from Тест Бизнес: Да, есть вакансия
📤 Sent to 77072245669@c.us: ...
```

The agent will ask follow-up questions for: `title`, `salary`, `employment_type`, `requirements`.

- [ ] **Step 5: Complete the conversation (answer all fields)**

Sample reply sequence that will complete collection:
1. "Да, есть вакансия" → agent asks for position name
2. "Продавец-консультант" → agent asks for salary
3. "150 000 тенге" → agent asks full/part/gig
4. "Полная занятость" → agent asks for requirements
5. "Опыт от 1 года, знание русского и казахского" → agent says спасибо, status → COMPLETED

- [ ] **Step 6: Verify Supabase was written correctly**

```bash
node -e "
import('dotenv/config').then(async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  const { data: biz } = await sb.from('businesses').select('status, wa_chat_id').eq('phone', '87072245669').single()
  console.log('Business status:', biz.status, '| wa_chat_id:', biz.wa_chat_id)

  const { data: msgs } = await sb.from('messages').select('role, content').order('created_at')
  console.log('Messages:', msgs.length)
  msgs.forEach(m => console.log(' ', m.role + ':', m.content.substring(0, 60)))

  const { data: jobs } = await sb.from('jobs').select('*')
  console.log('Jobs:', JSON.stringify(jobs, null, 2))
})"
```

Expected:
- `business.status` = `COMPLETED`
- `business.wa_chat_id` = `77072245669@c.us`
- messages table has full conversation history (role: agent + role: business)
- jobs table has 1 row with `title`, `salary`, `employment_type`, `requirements` all filled

---

## Self-Review

**Spec coverage:**
- ✅ Agent holds multi-turn conversation via WhatsApp
- ✅ Gemini extracts job fields from Russian text
- ✅ Data saved to `jobs` + `messages` + `businesses.status` updated in Supabase
- ✅ Test triggered via `contact-phone` endpoint with `87072245669`
- ✅ QR code available at `/qr` for session auth

**Placeholder scan:** None found — all steps contain actual code or commands.

**Type consistency:** `processMessage` signature unchanged; `extractJSON` is local to `gemini.js`; `contactBusiness` import in `index.js` already exists.
