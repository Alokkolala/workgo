import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { supabase } from './supabase.js'
import { addLogClient, log } from './logger.js'
import { initWhatsApp, setMessageHandler, getQRImageDataURL, getIsReady, sendMessage } from './whatsapp.js'
import { processIncomingMessage, contactBusiness, contactAllDiscovered } from './agent.js'

import scrapeRouter from './routes/scrape.js'
import businessesRouter from './routes/businesses.js'

const app = express()
app.use(cors())
app.use(express.json())

// Wire the message handler (breaks circular dep: whatsapp ↔ agent)
setMessageHandler(processIncomingMessage)

// ── QR code page ─────────────────────────────────────────────────
app.get('/qr', async (req, res) => {
  if (getIsReady()) {
    return res.send('<h2 style="font-family:sans-serif;padding:40px">✅ WhatsApp already connected!</h2>')
  }
  const dataUrl = await getQRImageDataURL()
  if (!dataUrl) {
    return res.send(`<html><head><meta http-equiv="refresh" content="3"><style>body{font-family:sans-serif;padding:40px}</style></head><body><h2>⏳ Waiting for QR code...</h2><p>Page will refresh automatically.</p></body></html>`)
  }
  res.send(`<html><head><meta http-equiv="refresh" content="20"><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;padding:40px;background:#f5f5f5}</style></head><body><h2>📱 Scan with WhatsApp</h2><p>WhatsApp → 3 dots → Linked Devices → Link a Device</p><img src="${dataUrl}" style="border:8px solid white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.15)"/><p style="color:#888;font-size:14px">QR refreshes every 20 seconds automatically</p></body></html>`)
})

// ── Existing routes ───────────────────────────────────────────────
app.use('/api/scrape', scrapeRouter)
app.use('/api/businesses', businessesRouter)

// ── SSE log stream ────────────────────────────────────────────────
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
  addLogClient(res)
  log('Terminal connected to server', 'system')
})

// ── Dashboard stats ───────────────────────────────────────────────
app.get('/api/dashboard/stats', async (req, res) => {
  const statuses = ['DISCOVERED', 'CONTACTED', 'INTERESTED', 'COLLECTING', 'COMPLETED', 'REJECTED']
  const stats = {}

  await Promise.all(
    statuses.map(async (s) => {
      const { count } = await supabase
        .from('businesses')
        .select('*', { count: 'exact', head: true })
        .eq('status', s)
      stats[s.toLowerCase()] = count || 0
    })
  )

  res.json(stats)
})

// ── WhatsApp contact routes ───────────────────────────────────────
// POST /api/contact/:id — contact a single business
app.post('/api/contact/:id', async (req, res) => {
  try {
    await contactBusiness(req.params.id)
    res.json({ ok: true, message: 'Contact initiated' })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/contact-phone — contact a business by phone number
// Body: { phone: "87072245669" }
app.post('/api/contact-phone', async (req, res) => {
  const { phone } = req.body
  if (!phone) return res.status(400).json({ ok: false, error: 'phone is required' })
  if (!getIsReady()) return res.status(503).json({ ok: false, error: 'WhatsApp not connected yet' })

  // Normalize phone to match stored format (11 digits, starting with 8 for KZ numbers)
  const digits = phone.replace(/\D/g, '')
  let normalizedPhone = digits
  if (digits.length === 11 && digits.startsWith('7')) {
    normalizedPhone = '8' + digits.slice(1)
  } else if (digits.length === 12 && digits.startsWith('77')) {
    normalizedPhone = '8' + digits.slice(2)
  }

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name, status')
    .eq('phone', normalizedPhone)
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

// POST /api/contact-all — contact all DISCOVERED businesses
app.post('/api/contact-all', async (req, res) => {
  res.json({ ok: true, message: 'Contacting all DISCOVERED businesses in background…' })
  contactAllDiscovered().catch((err) =>
    console.error('contactAllDiscovered background error:', err)
  )
})

// ── Message history ───────────────────────────────────────────────
app.get('/api/businesses/:id/messages', async (req, res) => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('business_id', req.params.id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── Static dashboard ──────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
app.use(express.static(join(__dirname, '../client')))

app.get('/health', (_, res) => res.json({ ok: true, whatsapp: getIsReady() }))

// POST /api/send — quick test: { to: "87072245669", message: "..." }
app.post('/api/send', async (req, res) => {
  const { to, message } = req.body
  if (!to || !message) return res.status(400).json({ ok: false, error: 'to and message are required' })
  if (!getIsReady()) return res.status(503).json({ ok: false, error: 'WhatsApp not connected yet' })
  try {
    const chatId = await sendMessage(to, message)
    res.json({ ok: true, chatId })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Boot ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000

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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is in use. Change PORT in .env and restart.`)
    process.exit(1)
  } else {
    throw err
  }
})
