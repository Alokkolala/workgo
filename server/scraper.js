import { chromium } from 'playwright'
import { supabase } from './supabase.js'
import { log } from './logger.js'

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
    waitUntil: 'domcontentloaded',
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
        await card.waitForSelector('[href^="tel:"]', { timeout: 3000 }).catch(() => null)
        const phoneEl = await card.$('[class*="_phone_"] a, [href^="tel:"]')
        if (phoneEl) {
          phone = (await phoneEl.innerText()).trim().replace(/\s+/g, '')
        }
      }

      results.push({
        name,
        phone,
        address,
        category: query.split(' Актау')[0], // e.g. "салон красоты"
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

  try {
    for (const query of CATEGORIES) {
      log(`Scraping 2GIS: "${query}"`, 'scraper')
      try {
        const businesses = await scrapeCategory(page, query)
        log(`  → Found ${businesses.length} businesses for "${query}"`, businesses.length > 0 ? 'success' : 'warn')
        allResults.push(...businesses)
      } catch (err) {
        log(`  → Failed for "${query}": ${err.message}`, 'error')
      }
    }
  } finally {
    await browser.close()
  }

  log(`Scrape complete — ${allResults.length} total found across all categories`, 'scraper')

  if (allResults.length === 0) return 0

  log(`Saving to Supabase (skipping duplicates by phone)…`, 'db')
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

  log(`Inserted ${data.length} new businesses into Supabase`, 'db')
  return data.length
}
