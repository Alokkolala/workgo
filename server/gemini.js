import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set in environment')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

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
  try {
    const result = await model.generateContent(prompt)
    raw = result.response.text()
  } catch (err) {
    throw new Error(`Gemini API call failed: ${err.message}`)
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
