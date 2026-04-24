import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

// API key rotation for reliability
const apiKeys = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP_1,
  process.env.GEMINI_API_KEY_BACKUP_2,
].filter(Boolean)

if (apiKeys.length === 0) throw new Error('No GEMINI_API_KEY configured')

let currentKeyIndex = 0
const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

function getModel() {
  const key = apiKeys[currentKeyIndex]
  const genAI = new GoogleGenerativeAI(key)
  return genAI.getGenerativeModel({ model: modelName })
}

/**
 * Extract the first valid JSON object from a string using balanced bracket scanning.
 * Handles markdown code fences and leading/trailing prose.
 */
function extractJSON(raw) {
  // Strip markdown code fences
  let text = raw.replace(/^```json?\s*/im, '').replace(/\s*```$/m, '').trim()

  // Balanced bracket scan for first complete JSON object
  const start = text.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in Gemini response')

  let depth = 0
  let inString = false
  let escape = false
  let end = -1

  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }

  if (end === -1) throw new Error('No JSON object found in Gemini response')
  return JSON.parse(text.slice(start, end + 1))
}

/**
 * @param {object} business      - row from businesses table
 * @param {Array}  history       - rows from messages table (sorted ASC)
 * @param {string} latestMessage - incoming text from the business owner
 * @param {object|null} currentJob - existing row from jobs table (or null)
 * @returns {Promise<{intent, extracted, next_message, next_state, collection_complete}>}
 */
export async function processMessage(business, history, latestMessage, currentJob) {
  const fields = ['title', 'salary', 'employment_type', 'requirements']

  const collected = fields
    .filter((f) => currentJob && currentJob[f])
    .map((f) => `${f}: ${currentJob[f]}`)
    .join(', ') || 'пока ничего'

  const missing = fields.filter((f) => !currentJob || !currentJob[f])
  const missingStr = missing.join(', ') || 'всё собрано'

  const historyText = (history || [])
    .map((m) => `${m.role === 'agent' ? 'Агент' : 'Владелец'}: ${m.content}`)
    .join('\n')

  const prompt = `Ты — дружелюбный HR-ассистент бесплатной платформы занятости для малого бизнеса в Актау, Казахстан.
Общаешься в WhatsApp с владельцем бизнеса. Пиши по-русски, коротко, разговорно, без формальностей.
Твоя задача — узнать детали вакансии в непринуждённой беседе. Задавай по ОДНОМУ вопросу за раз.
Не давай длинных объяснений. Если владелец не заинтересован — вежливо закончи разговор.

Бизнес: «${business.name}»
Текущий статус: ${business.status}
Уже собрано: ${collected}
Ещё нужно: ${missingStr}

История переписки:
${historyText || '(начало разговора)'}

Последнее сообщение от владельца: "${latestMessage}"

Нужные поля вакансии:
- title: название должности
- salary: зарплата (любой формат)
- employment_type: "full" (полная занятость, 8 часов), "part" (неполный день/подработка), "gig" (разовая/проектная)
- requirements: требования к кандидату

Если владелец говорит что вакансий нет — next_state: "REJECTED", collection_complete: false.
Если все 4 поля собраны — next_state: "COMPLETED", collection_complete: true.
Если часть полей собрана — next_state: "COLLECTING".
Если только выразил интерес — next_state: "INTERESTED".

Ответь ТОЛЬКО валидным JSON без какого-либо другого текста:
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
}`

  let raw
  let lastError = null

  // Try up to 3 attempts total, rotating keys if needed
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const model = getModel()
      const result = await model.generateContent(prompt)
      raw = result.response.text()
      console.log(`✓ Gemini API call succeeded on key index ${currentKeyIndex}`)
      break
    } catch (err) {
      lastError = err
      console.warn(`⚠️  Attempt ${attempt}/3 failed (${err.message})`)

      // If this was a key quota/auth error, rotate to next key
      if (attempt < 3 && (err.message.includes('API_KEY_INVALID') || err.message.includes('RESOURCE_EXHAUSTED') || err.message.includes('403'))) {
        const nextIndex = (currentKeyIndex + 1) % apiKeys.length
        if (nextIndex !== currentKeyIndex) {
          console.log(`🔄 Rotating to API key ${nextIndex}/${apiKeys.length - 1}`)
          currentKeyIndex = nextIndex
        }
      }

      // Wait before retry
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  if (!raw) {
    throw new Error(`Gemini API call failed after 3 attempts: ${lastError?.message}`)
  }

  const parsed = extractJSON(raw)

  // Ensure required fields exist with safe defaults
  return {
    intent: parsed.intent ?? 'unclear',
    extracted: {
      title: parsed.extracted?.title ?? null,
      salary: parsed.extracted?.salary ?? null,
      employment_type: parsed.extracted?.employment_type ?? null,
      requirements: parsed.extracted?.requirements ?? null,
    },
    next_message: parsed.next_message ?? 'Извините, не понял. Можете повторить?',
    next_state: parsed.next_state ?? 'COLLECTING',
    collection_complete: parsed.collection_complete ?? false,
  }
}
