import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP_1,
  process.env.GEMINI_API_KEY_BACKUP_2,
].filter(Boolean)

if (apiKeys.length === 0) throw new Error('No GEMINI_API_KEY configured')

let keyIndex = 0
const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

function getModel() {
  const genAI = new GoogleGenerativeAI(apiKeys[keyIndex])
  return genAI.getGenerativeModel({ model: modelName })
}

/**
 * Returns top matching jobs for an applicant profile.
 * @param {{ skills, experience, employment_type, district }} applicant
 * @param {Array} jobs - job objects with businesses joined
 * @returns {Promise<Array<{ job_id, score, reason, job }>>}
 */
export async function matchJobsForApplicant(applicant, jobs) {
  if (!jobs.length) return []

  const prompt = `Ты — AI для подбора вакансий на платформе занятости в Актау, Казахстан.

Профиль соискателя:
- Навыки: ${applicant.skills || 'не указаны'}
- Опыт: ${applicant.experience || 'не указан'}
- Желаемый тип занятости: ${applicant.employment_type || 'любой'}
- Район: ${applicant.district || 'любой'}

Список активных вакансий (JSON):
${JSON.stringify(jobs.map(j => ({
  id: j.id,
  title: j.title,
  description: j.description,
  salary: j.salary,
  employment_type: j.employment_type,
  requirements: j.requirements,
  business_name: j.businesses?.name,
  address: j.businesses?.address
})))}

Верни ТОЛЬКО JSON-массив до 5 лучших совпадений (score >= 5).
Формат: [{"job_id":"uuid","score":1-10,"reason":"краткое объяснение на русском"}]
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

  if (!raw) throw new Error(`Gemini match failed: ${lastError?.message}`)

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const matches = JSON.parse(match[0])
    return matches
      .filter(m => jobs.find(j => j.id === m.job_id))
      .map(m => ({ ...m, job: jobs.find(j => j.id === m.job_id) }))
  } catch {
    return []
  }
}
