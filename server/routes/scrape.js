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
