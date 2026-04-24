# WhatsApp Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WhatsApp engine that reads businesses from Supabase and conducts multi-turn AI conversations with them via whatsapp-web.js to collect job vacancy data.

**Architecture:** Express server boots and initialises a persistent whatsapp-web.js session (QR scan once, session saved to disk). `agent.js` is the brain — `contactBusiness()` sends the first message and stores `wa_chat_id`; `processIncomingMessage()` handles every reply by calling Gemini, updating Supabase, and sending the next WhatsApp message. `gemini.js` holds a placeholder system prompt that will be swapped in later.

**Tech Stack:** Node.js / CommonJS, Express, whatsapp-web.js + qrcode-terminal, @supabase/supabase-js, @google/generative-ai (Gemini 2.5 Flash), dotenv

---

## File Map

| File | Responsibility |
|---|---|
| `package.json` | Project deps & scripts |
| `.env` | Secrets (never committed) |
| `server/supabase.js` | Supabase client singleton |
| `server/gemini.js` | Gemini call + JSON parsing; placeholder system prompt |
| `server/whatsapp.js` | WA client init, QR display, `sendMessage()`, incoming-message router |
| `server/agent.js` | `contactBusiness()` + `processIncomingMessage()` |
| `server/index.js` | Express entry point; boots WA client on start |

---

## Task 1: Initialize project

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `server/` directory

- [ ] **Step 1: Create package.json**

```json
{
  "name": "mangystau-jobs",
  "version": "1.0.0",
  "description": "AI employment platform for Aktau — WhatsApp agent",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "dev": "nodemon server/index.js"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "@supabase/supabase-js": "^2.49.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "qrcode-terminal": "^0.12.0",
    "whatsapp-web.js": "^1.26.1-alpha.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create .env**

```
SUPABASE_URL=https://yjfwlgerugzgjebfwrnl.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqZndsZ2VydWd6Z2plYmZ3cm5sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzAxNjI5MywiZXhwIjoyMDkyNTkyMjkzfQ.5FSr1WxVeHk5qwMdwwbexKL5xMFOyGfLKZVPCW0oVq4
GEMINI_API_KEY=your_gemini_key_here
PORT=3000
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/zs/Documents/react/alok-hackathon && npm install`

Expected: `node_modules/` created, `package-lock.json` written, no errors.

- [ ] **Step 4: Create server directory**

Run: `mkdir -p /Users/zs/Documents/react/alok-hackathon/server`

- [ ] **Step 5: Commit**

```bash
git init
echo "node_modules/" >> .gitignore
echo ".env" >> .gitignore
echo ".wwebjs_auth/" >> .gitignore
git add package.json package-lock.json .gitignore
git commit -m "chore: initialise Node project with WhatsApp engine deps"
```

---

## Task 2: Supabase client singleton

**Files:**
- Create: `server/supabase.js`

- [ ] **Step 1: Write server/supabase.js**

```javascript
// server/supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
```

- [ ] **Step 2: Smoke-test the connection**

Create a temp file `server/_test_supabase.js`, run it, then delete it:

```javascript
// server/_test_supabase.js
const { supabase } = require('./supabase.js');
(async () => {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, status')
    .limit(3);
  if (error) { console.error('❌ Supabase error:', error.message); process.exit(1); }
  console.log('✅ Supabase connected. Sample rows:', data);
})();
```

Run: `node server/_test_supabase.js`

Expected output: `✅ Supabase connected. Sample rows: [...]` (array, may be empty if no rows yet — that's fine)

Delete: `rm server/_test_supabase.js`

- [ ] **Step 3: Commit**

```bash
git add server/supabase.js
git commit -m "feat: add Supabase client singleton"
```

---

## Task 3: Gemini conversation engine (placeholder prompt)

**Files:**
- Create: `server/gemini.js`

- [ ] **Step 1: Write server/gemini.js**

```javascript
// server/gemini.js
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ================================================================
// SYSTEM PROMPT — swap this out when you send the final prompt
// ================================================================
const SYSTEM_PROMPT = `
You are a friendly HR assistant for a free job platform in Aktau, Kazakhstan.
You are collecting job vacancy details from a small business owner via WhatsApp.
Communicate in Russian. Be casual, short, and friendly.
`;
// ================================================================

/**
 * @param {object} business  - row from businesses table
 * @param {Array}  history   - rows from messages table (sorted ASC)
 * @param {string} latestMessage - the incoming text from the business owner
 * @param {object|null} currentJob - existing row from jobs table for this business (or null)
 * @returns {Promise<{intent, extracted, next_message, next_state, collection_complete}>}
 */
async function processMessage(business, history, latestMessage, currentJob) {
  const fields = ['title', 'salary', 'employment_type', 'requirements'];

  const collected = fields
    .filter((f) => currentJob && currentJob[f])
    .map((f) => `${f}: ${currentJob[f]}`)
    .join(', ') || 'none yet';

  const missing = fields
    .filter((f) => !currentJob || !currentJob[f])
    .join(', ');

  const historyText = (history || [])
    .map((m) => `${m.role === 'agent' ? 'Агент' : 'Владелец'}: ${m.content}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}

Current business state: ${business.status}
Business name: ${business.name}
Collected fields so far: ${collected}
Missing fields: ${missing}

Conversation history:
${historyText}

Latest message from business owner: "${latestMessage}"

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
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  // Strip markdown code fences if Gemini wraps its output
  const jsonText = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/, '');

  return JSON.parse(jsonText);
}

module.exports = { processMessage };
```

- [ ] **Step 2: Smoke-test Gemini (requires a real API key in .env)**

Create `server/_test_gemini.js`, run, delete:

```javascript
// server/_test_gemini.js
const { processMessage } = require('./gemini.js');
(async () => {
  const fakeBusiness = { id: 'test-1', name: 'Кафе Актау', status: 'CONTACTED' };
  const fakeHistory = [
    { role: 'agent', content: 'Здравствуйте! У вас есть вакансии?' }
  ];
  const response = await processMessage(
    fakeBusiness,
    fakeHistory,
    'Да, нам нужен повар',
    null
  );
  console.log('✅ Gemini response:', JSON.stringify(response, null, 2));
})();
```

Run: `node server/_test_gemini.js`

Expected: JSON object with `intent`, `extracted`, `next_message`, `next_state`, `collection_complete` keys printed. No errors.

Delete: `rm server/_test_gemini.js`

- [ ] **Step 3: Commit**

```bash
git add server/gemini.js
git commit -m "feat: add Gemini conversation engine with placeholder system prompt"
```

---

## Task 4: WhatsApp client

**Files:**
- Create: `server/whatsapp.js`

- [ ] **Step 1: Write server/whatsapp.js**

```javascript
// server/whatsapp.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let client = null;
let isReady = false;

/**
 * Format a phone number (any format) to WhatsApp chat ID.
 * Handles Kazakh numbers starting with 8 → 7.
 */
function formatPhoneToWA(phone) {
  let digits = phone.replace(/\D/g, '');
  // Kazakhstan local numbers sometimes start with 8 (11 digits total)
  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1);
  }
  return digits + '@c.us';
}

/**
 * Start the WhatsApp client. Resolves when the session is ready.
 * On first run, prints a QR code to the terminal.
 * Session is persisted to .wwebjs_auth/ so subsequent starts skip QR.
 */
function initWhatsApp() {
  return new Promise((resolve, reject) => {
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: '.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    client.on('qr', (qr) => {
      console.log('\n📱 Scan this QR code with WhatsApp on your phone:\n');
      qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
      console.log('✅ WhatsApp client ready!');
      isReady = true;
      resolve(client);
    });

    client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp auth failed:', msg);
      reject(new Error(msg));
    });

    // Lazy-require agent.js to avoid circular dependency at module load time
    client.on('message', async (msg) => {
      if (msg.fromMe) return; // ignore echoes

      try {
        const { supabase } = require('./supabase.js');

        // Look up business by the wa_chat_id we stored when contacting them
        const { data: businesses, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('wa_chat_id', msg.from)
          .limit(1);

        if (error) {
          console.error('Supabase lookup error:', error.message);
          return;
        }

        if (!businesses || businesses.length === 0) {
          console.log(`⚠️  Received message from unknown number: ${msg.from}`);
          return;
        }

        const business = businesses[0];
        const activeStatuses = ['CONTACTED', 'INTERESTED', 'COLLECTING'];

        if (!activeStatuses.includes(business.status)) {
          console.log(`ℹ️  Ignoring message from ${business.name} — status: ${business.status}`);
          return;
        }

        console.log(`📥 Incoming from ${business.name}: ${msg.body.substring(0, 80)}`);
        const { processIncomingMessage } = require('./agent.js');
        await processIncomingMessage(business.id, msg.body);
      } catch (err) {
        console.error('Message handler error:', err);
      }
    });

    client.on('disconnected', (reason) => {
      console.warn('⚠️  WhatsApp disconnected:', reason);
      isReady = false;
    });

    client.initialize();
  });
}

/**
 * Send a WhatsApp message.
 * @param {string} phone - raw phone string from Supabase (any format)
 * @param {string} text  - message body
 * @returns {Promise<string>} - the wa_chat_id used (e.g. "77012345678@c.us")
 */
async function sendMessage(phone, text) {
  if (!client || !isReady) {
    throw new Error('WhatsApp client is not ready — cannot send message');
  }
  const chatId = formatPhoneToWA(phone);
  await client.sendMessage(chatId, text);
  console.log(`📤 Sent to ${chatId}: ${text.substring(0, 60)}…`);
  return chatId;
}

module.exports = { initWhatsApp, sendMessage, formatPhoneToWA };
```

- [ ] **Step 2: Commit**

```bash
git add server/whatsapp.js
git commit -m "feat: add whatsapp-web.js client with QR auth and phone normalisation"
```

---

## Task 5: Core agent loop

**Files:**
- Create: `server/agent.js`

- [ ] **Step 1: Write server/agent.js**

```javascript
// server/agent.js
const { supabase } = require('./supabase.js');
const { processMessage } = require('./gemini.js');
const { sendMessage, formatPhoneToWA } = require('./whatsapp.js');

/**
 * Build the first outreach message for a business.
 */
function buildFirstMessage(businessName) {
  return (
    `Здравствуйте! Меня зовут Айдар, я представляю бесплатную платформу занятости для бизнесов Актау.\n` +
    `Увидел ваш бизнес «${businessName}» на 2GIS. Помогаем быстро найти сотрудников — бесплатно.\n` +
    `У вас есть открытые вакансии? 🙂`
  );
}

/**
 * Send the first WhatsApp message to a DISCOVERED business.
 * Updates status → CONTACTED and stores wa_chat_id.
 */
async function contactBusiness(businessId) {
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (error || !business) {
    console.error(`contactBusiness: business ${businessId} not found`);
    return;
  }

  if (!business.phone) {
    console.warn(`contactBusiness: no phone for "${business.name}" — skipping`);
    return;
  }

  const firstMessage = buildFirstMessage(business.name);

  // Send via WhatsApp and capture the chat ID
  let waChatId;
  try {
    waChatId = await sendMessage(business.phone, firstMessage);
  } catch (err) {
    console.error(`contactBusiness: failed to send to "${business.name}":`, err.message);
    return;
  }

  // Persist outgoing message
  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'agent',
    content: firstMessage,
  });

  // Update business status and store wa_chat_id for reply matching
  await supabase
    .from('businesses')
    .update({
      status: 'CONTACTED',
      wa_chat_id: waChatId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId);

  console.log(`📨 Contacted: ${business.name} (${waChatId})`);
}

/**
 * Process an incoming reply from a business owner.
 * Runs the full agent loop: save → Gemini → update DB → reply via WA.
 */
async function processIncomingMessage(businessId, incomingText) {
  // 1. Load business
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (bizErr || !business) {
    console.error(`processIncomingMessage: business ${businessId} not found`);
    return;
  }

  // 2. Save incoming message
  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'business',
    content: incomingText,
  });

  // 3. Load full message history (for context)
  const { data: history } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true });

  // 4. Load existing job record for this business (if any)
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('business_id', businessId)
    .limit(1);

  const currentJob = existingJobs && existingJobs.length > 0 ? existingJobs[0] : null;

  // 5. Call Gemini
  let geminiResponse;
  try {
    geminiResponse = await processMessage(business, history || [], incomingText, currentJob);
  } catch (err) {
    console.error(`Gemini error for "${business.name}":`, err.message);
    return; // don't crash the server; skip this message
  }

  const { extracted, next_message, next_state, collection_complete } = geminiResponse;

  // 6. Update business status
  await supabase
    .from('businesses')
    .update({ status: next_state, updated_at: new Date().toISOString() })
    .eq('id', businessId);

  // 7. Upsert job data if Gemini extracted anything
  const hasExtracted =
    extracted &&
    (extracted.title || extracted.salary || extracted.employment_type || extracted.requirements);

  if (hasExtracted) {
    if (currentJob) {
      // Only overwrite fields that Gemini actually found (don't blank out existing data)
      const patch = {};
      if (extracted.title) patch.title = extracted.title;
      if (extracted.salary) patch.salary = extracted.salary;
      if (extracted.employment_type) patch.employment_type = extracted.employment_type;
      if (extracted.requirements) patch.requirements = extracted.requirements;
      if (collection_complete) patch.status = 'active';

      await supabase.from('jobs').update(patch).eq('id', currentJob.id);
    } else {
      await supabase.from('jobs').insert({
        business_id: businessId,
        title: extracted.title || null,
        salary: extracted.salary || null,
        employment_type: extracted.employment_type || null,
        requirements: extracted.requirements || null,
        location: 'Актау',
        status: collection_complete ? 'active' : 'active',
      });
    }
  }

  // 8. Save agent reply
  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'agent',
    content: next_message,
  });

  // 9. Send reply via WhatsApp
  try {
    await sendMessage(business.phone, next_message);
  } catch (err) {
    console.error(`Failed to send reply to "${business.name}":`, err.message);
  }

  if (collection_complete) {
    console.log(`✅ Job collection complete for: ${business.name}`);
  }
}

/**
 * Contact all DISCOVERED businesses that have a phone number.
 * Safe to call multiple times — only touches DISCOVERED status rows.
 */
async function contactAllDiscovered() {
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('status', 'DISCOVERED')
    .not('phone', 'is', null);

  if (error) {
    console.error('contactAllDiscovered error:', error.message);
    return;
  }

  console.log(`🚀 Contacting ${businesses.length} DISCOVERED businesses…`);

  for (const b of businesses) {
    await contactBusiness(b.id);
    // Small delay to avoid flooding WhatsApp
    await new Promise((r) => setTimeout(r, 2000));
  }
}

module.exports = { contactBusiness, processIncomingMessage, contactAllDiscovered };
```

- [ ] **Step 2: Commit**

```bash
git add server/agent.js
git commit -m "feat: add core agent loop — contactBusiness + processIncomingMessage"
```

---

## Task 6: Express server entry point

**Files:**
- Create: `server/index.js`

- [ ] **Step 1: Write server/index.js**

```javascript
// server/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { supabase } = require('./supabase.js');
const { initWhatsApp } = require('./whatsapp.js');
const { contactBusiness, contactAllDiscovered } = require('./agent.js');

const app = express();
app.use(cors());
app.use(express.json());

// ── Dashboard stats ───────────────────────────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
  const statuses = ['DISCOVERED', 'CONTACTED', 'INTERESTED', 'COLLECTING', 'COMPLETED', 'REJECTED'];
  const stats = {};

  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('status', s);
      stats[s.toLowerCase()] = count || 0;
    })
  );

  res.json(stats);
});

// ── Contact a single business ─────────────────────────────────────
// POST /api/contact/:id
app.post('/api/contact/:id', async (req, res) => {
  try {
    await contactBusiness(req.params.id);
    res.json({ ok: true, message: 'Contact initiated' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Contact all DISCOVERED businesses ────────────────────────────
// POST /api/contact-all
app.post('/api/contact-all', async (req, res) => {
  res.json({ ok: true, message: 'Contacting all DISCOVERED businesses in background…' });
  contactAllDiscovered().catch((err) =>
    console.error('contactAllDiscovered background error:', err)
  );
});

// ── List businesses ───────────────────────────────────────────────
app.get('/api/businesses', async (req, res) => {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, phone, status, wa_chat_id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── List messages for a business ─────────────────────────────────
app.get('/api/businesses/:id/messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Boot ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`\n🌐 Server running on http://localhost:${PORT}`);
  console.log('📲 Initialising WhatsApp…');
  try {
    await initWhatsApp();
    console.log('🟢 WhatsApp connected — engine ready.\n');
  } catch (err) {
    console.error('❌ WhatsApp init failed:', err.message);
    console.log('Server will run but WhatsApp features are disabled.');
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add server/index.js
git commit -m "feat: add Express server with WhatsApp boot and contact endpoints"
```

---

## Task 7: End-to-end test

- [ ] **Step 1: Start the server**

Run: `node server/index.js`

Expected output:
```
🌐 Server running on http://localhost:3000
📲 Initialising WhatsApp…
📱 Scan this QR code with WhatsApp on your phone:
[QR code printed in terminal]
```

Scan the QR code from your phone's WhatsApp → Linked Devices.

Expected after scan:
```
✅ WhatsApp client ready!
🟢 WhatsApp connected — engine ready.
```

- [ ] **Step 2: Verify Supabase stats endpoint**

Open a new terminal:
Run: `curl http://localhost:3000/api/dashboard/stats`

Expected: `{"discovered":N,"contacted":0,"interested":0,"collecting":0,"completed":0,"rejected":0}`

- [ ] **Step 3: Seed a test business in Supabase (if none exist)**

If `GET /api/businesses` returns an empty array, insert a test row in the Supabase dashboard SQL editor:

```sql
INSERT INTO businesses (name, phone, category, address, status)
VALUES ('Тест Кафе', '+77012345678', 'кафе', 'Актау, мкр 12', 'DISCOVERED');
```

- [ ] **Step 4: Trigger contact for the test business**

Run: `curl -X POST http://localhost:3000/api/contact-all`

Expected server log:
```
🚀 Contacting 1 DISCOVERED businesses…
📤 Sent to 77012345678@c.us: Здравствуйте! Меня зовут Айдар…
📨 Contacted: Тест Кафе (77012345678@c.us)
```

Verify in Supabase: business status → `CONTACTED`, `wa_chat_id` populated.

- [ ] **Step 5: Simulate an incoming reply**

When the test number replies "Да, нам нужен повар" on WhatsApp, the server log should show:
```
📥 Incoming from Тест Кафе: Да, нам нужен повар
📤 Sent to 77012345678@c.us: [Gemini reply]
```

Verify in Supabase: new row in `messages` table with `role = 'business'` and a new `role = 'agent'` reply.

---

## Updating the System Prompt (when you send it)

When you provide the final Gemini system prompt, open `server/gemini.js` and replace the `SYSTEM_PROMPT` constant between the two `// ====` comment blocks. No other file needs to change.

---

## Verification Checklist

- [ ] `node server/index.js` starts without errors
- [ ] QR code appears in terminal on first run; session persists on subsequent runs
- [ ] `GET /api/dashboard/stats` returns correct counts from Supabase
- [ ] `POST /api/contact-all` sends WhatsApp messages and updates status → `CONTACTED`
- [ ] Incoming WhatsApp replies from known numbers trigger `processIncomingMessage`
- [ ] `messages` table records both `agent` and `business` turns
- [ ] `businesses.status` progresses through the state machine
- [ ] `jobs` table gets upserted as Gemini extracts fields
