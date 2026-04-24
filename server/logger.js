// Simple SSE log broadcaster
// Usage: import { log } from './logger.js'
//        log('message', 'scraper') — types: info, success, error, warn, scraper, db, system

const clients = new Set()

export function addLogClient(res) {
  clients.add(res)
  res.on('close', () => clients.delete(res))
}

export function log(msg, type = 'info') {
  const line = JSON.stringify({ msg, type })
  // also print to console
  console.log(`[${type}] ${msg}`)
  for (const res of clients) {
    res.write(`data: ${line}\n\n`)
  }
}
