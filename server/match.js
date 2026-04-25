import 'dotenv/config'
import Together from 'together-ai'
import { buildFallbackCandidateMatches, buildFallbackJobMatches } from './match.helpers.js'

const apiKeys = [
  process.env.TOGETHER_API_KEY,
  process.env.TOGETHER_API_KEY_BACKUP_1,
  process.env.TOGETHER_API_KEY_BACKUP_2,
].filter(Boolean)

if (apiKeys.length === 0) throw new Error('No TOGETHER_API_KEY configured')

let keyIndex = 0
const modelName     = process.env.TOGETHER_MODEL          || 'openai/gpt-oss-120b'
const fallbackModel = process.env.TOGETHER_MODEL_FALLBACK || 'moonshotai/Kimi-K2.6'

function getClient() {
  return new Together({ apiKey: apiKeys[keyIndex] })
}

function isKeyError(err) {
  const msg = err.message || ''
  return (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('429') ||
    msg.includes('invalid_api_key') ||
    msg.includes('rate_limit')
  )
}

async function callWithFallback(messages) {
  let raw = null
  let lastError = null

  // Phase 1: primary model with key rotation
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const client = getClient()
      const result = await client.chat.completions.create({
        model: modelName,
        messages,
      })
      raw = result.choices[0].message.content
      break
    } catch (err) {
      lastError = err
      if (attempt < 3 && isKeyError(err)) {
        keyIndex = (keyIndex + 1) % apiKeys.length
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000))
    }
  }

  // Phase 2: fallback model
  if (!raw) {
    keyIndex = 0
    try {
      const client = getClient()
      const result = await client.chat.completions.create({
        model: fallbackModel,
        messages,
      })
      raw = result.choices[0].message.content
    } catch (err) {
      lastError = err
    }
  }

  return { raw, lastError }
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

  const { raw, lastError } = await callWithFallback([{ role: 'user', content: prompt }])

  if (!raw) {
    console.warn(`Warning: Falling back to heuristic job matching: ${lastError?.message}`)
    return buildFallbackJobMatches(applicant, jobs)
  }

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const matches = JSON.parse(match[0])
    return matches
      .filter(m => jobs.find(j => j.id === m.job_id))
      .map(m => ({ ...m, job: jobs.find(j => j.id === m.job_id) }))
  } catch {
    return buildFallbackJobMatches(applicant, jobs)
  }
}

/**
 * Returns top matching applicants for a job posting.
 * @param {{ id, title, description, salary, employment_type, requirements }} job
 * @param {Array} applicants - applicant objects
 * @returns {Promise<Array<{ applicant_id, score, reason, applicant }>>}
 */
export async function matchCandidatesForJob(job, applicants) {
  if (!applicants.length) return []

  const prompt = `Ты — AI для подбора сотрудников на платформе занятости в Актау, Казахстан.

Вакансия:
- Должность: ${job.title || 'не указана'}
- Описание: ${job.description || 'нет'}
- Зарплата: ${job.salary || 'не указана'}
- Тип занятости: ${job.employment_type || 'любой'}
- Требования: ${job.requirements || 'не указаны'}

Список соискателей (JSON):
${JSON.stringify(applicants.map(a => ({
  id: a.id,
  skills: a.skills,
  experience: a.experience,
  employment_type: a.employment_type,
  district: a.district,
  bio: a.bio,
})))}

Верни ТОЛЬКО JSON-массив до 5 лучших кандидатов (score >= 5).
Формат: [{"applicant_id":"uuid","score":1-10,"reason":"краткое объяснение на русском"}]
Отсортируй по score убывания. Ничего кроме JSON.`

  const { raw, lastError } = await callWithFallback([{ role: 'user', content: prompt }])

  if (!raw) {
    console.warn(`Warning: Falling back to heuristic candidate matching: ${lastError?.message}`)
    return buildFallbackCandidateMatches(job, applicants)
  }

  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    const matches = JSON.parse(match[0])
    return matches
      .filter(m => applicants.find(a => a.id === m.applicant_id))
      .map(m => ({ ...m, applicant: applicants.find(a => a.id === m.applicant_id) }))
  } catch {
    return buildFallbackCandidateMatches(job, applicants)
  }
}
