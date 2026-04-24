import wwebjs from 'whatsapp-web.js'
const { Client, LocalAuth } = wwebjs
import QRCode from 'qrcode'
import qrcodeTerminal from 'qrcode-terminal'
import { supabase } from './supabase.js'
import fs from 'fs'
import path from 'path'

const WA_DATA_PATH = 'C:\\wwebjs_workgo'
const WA_CLIENT_ID = 'main'

// Clear Chromium singleton locks left by crashed processes
function clearLocks() {
  const sessionDir = path.join(WA_DATA_PATH, `session-${WA_CLIENT_ID}`)
  for (const lock of ['SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
    const p = path.join(sessionDir, lock)
    try { fs.unlinkSync(p); console.log(`🧹 Cleared lock: ${lock}`) } catch (_) {}
  }
}

let client = null
let isReady = false
let latestQR = null  // latest QR string for /qr endpoint

// Message rate limiting - 2 second delay between messages to avoid WhatsApp bans
const MESSAGE_DELAY_MS = 2000
let lastMessageTime = 0

export function getLatestQR() { return latestQR }
export function getIsReady() { return isReady }

// Set by index.js to break the circular dep (whatsapp ↔ agent)
let _messageHandler = null
export function setMessageHandler(fn) {
  _messageHandler = fn
}

/**
 * Format a phone number (any format) to WhatsApp chat ID.
 * Handles Kazakh numbers starting with 8 → 7.
 */
export function formatPhoneToWA(phone) {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('8') && digits.length === 11) {
    digits = '7' + digits.slice(1)
  }
  return digits + '@c.us'
}

/**
 * Start the WhatsApp client. Resolves when the session is ready.
 * Session persisted to WA_DATA_PATH so subsequent starts skip QR.
 */
export function initWhatsApp() {
  clearLocks()
  return new Promise((resolve, reject) => {
    client = new Client({
      authStrategy: new LocalAuth({ dataPath: WA_DATA_PATH, clientId: WA_CLIENT_ID }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    })

    client.on('qr', (qr) => {
      latestQR = qr
      const port = process.env.PORT || 3000
      console.log(`\n📱 Scan QR below OR open http://localhost:${port}/qr in browser:\n`)
      qrcodeTerminal.generate(qr, { small: true })
    })

    client.on('ready', () => {
      console.log('✅ WhatsApp client ready!')
      latestQR = null
      isReady = true
      resolve(client)
    })

    client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp auth failed:', msg)
      reject(new Error(msg))
    })

    client.on('message', async (msg) => {
      if (msg.fromMe) return

      try {
        // Primary lookup by stored wa_chat_id
        let { data: businesses, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('wa_chat_id', msg.from)
          .limit(1)

        if (error) {
          console.error('Supabase lookup error:', error.message)
          return
        }

        // Fallback: @lid format — resolve real phone via contact, then match by phone
        if (!businesses || businesses.length === 0) {
          try {
            const contact = await msg.getContact()
            const phone = contact.number // e.g. "77072245669"
            // Try both 7-prefix and 8-prefix (KZ stored as 8xxxxxxxxxx)
            const alt = phone.startsWith('7') && phone.length === 11
              ? '8' + phone.slice(1)
              : phone
            const result = await supabase
              .from('businesses')
              .select('*')
              .in('phone', [phone, alt])
              .limit(1)
            if (!result.error && result.data && result.data.length > 0) {
              businesses = result.data
              // Update wa_chat_id so future messages match directly
              await supabase
                .from('businesses')
                .update({ wa_chat_id: msg.from })
                .eq('id', result.data[0].id)
              console.log(`🔗 Resolved @lid ${msg.from} → ${result.data[0].name} (phone ${phone})`)
            }
          } catch (lidErr) {
            console.warn('⚠️  Could not resolve @lid contact:', lidErr.message)
          }
        }

        if (!businesses || businesses.length === 0) {
          console.log(`⚠️  Received message from unknown number: ${msg.from}`)
          return
        }

        const business = businesses[0]
        const activeStatuses = ['CONTACTED', 'INTERESTED', 'COLLECTING']

        if (!activeStatuses.includes(business.status)) {
          console.log(`ℹ️  Ignoring message from ${business.name} — status: ${business.status}`)
          return
        }

        console.log(`📥 Incoming from ${business.name}: ${msg.body.substring(0, 80)}`)

        if (_messageHandler) {
          await _messageHandler(business.id, msg.body)
        } else {
          console.warn('⚠️  No message handler set')
        }
      } catch (err) {
        console.error('Message handler error:', err)
      }
    })

    client.on('disconnected', (reason) => {
      console.warn('⚠️  WhatsApp disconnected:', reason)
      isReady = false
    })

    client.initialize()
  })
}

/**
 * Send a WhatsApp message with rate limiting to avoid bans.
 */
export async function sendMessage(phone, text) {
  if (!client || !isReady) {
    throw new Error('WhatsApp client is not ready — cannot send message')
  }

  // Rate limiting: enforce delay between messages
  const now = Date.now()
  const timeSinceLastMsg = now - lastMessageTime
  if (timeSinceLastMsg < MESSAGE_DELAY_MS) {
    const waitTime = MESSAGE_DELAY_MS - timeSinceLastMsg
    console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next message…`)
    await new Promise(resolve => setTimeout(resolve, waitTime))
  }

  const chatId = formatPhoneToWA(phone)
  await client.sendMessage(chatId, text)
  lastMessageTime = Date.now()
  console.log(`📤 Sent to ${chatId}: ${text.substring(0, 60)}…`)
  return chatId
}

/**
 * Render the latest QR as a PNG data URL (for /qr endpoint).
 */
export async function getQRImageDataURL() {
  if (!latestQR) return null
  return QRCode.toDataURL(latestQR, { width: 400, margin: 2 })
}
