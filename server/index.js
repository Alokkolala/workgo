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
