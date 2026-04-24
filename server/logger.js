// Simple SSE log broadcaster with businessId support for dashboard filtering
// Usage: import { log } from './logger.js'
// Types: info, success, error, warn, scraper, db, system, wa_in, wa_out, gemini_req, gemini_res, state

const clients = new Set()

export function addLogClient(res) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

/**
 * Broadcast a log event to all connected SSE clients.
 * @param {string} msg - Human-readable message
 * @param {string} type - info|success|error|warn|scraper|db|system|wa_in|wa_out|gemini_req|gemini_res|state
 * @param {string|null} businessId - UUID of the business this event belongs to (null for system events)
 * @param {any} data - Optional structured payload (extracted JSON, message text, etc.)
 */
export function log(msg, type = 'info', businessId = null, data = null) {
  const line = JSON.stringify({ msg, type, businessId, data })
  console.log(`[${type}] ${msg}`)
  for (const res of clients) {
    res.write(`data: ${line}\n\n`)
  }
}
