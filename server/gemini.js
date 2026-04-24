import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

/**
 * Extract the first valid JSON object from a string.
 * Handles markdown code fences and leading/trailing prose.
 */
function extractJSON(raw) {
  // Strip markdown code fences
  let text = raw.replace(/^```json?\s*/im, '').replace(/\s*```$/m, '').trim()

  // Find first { ... } block
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response')
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
- employment_type: "full" (полная), "part" (частичная), "gig" (разовая)
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

  const result = await model.generateContent(prompt)
  const raw = result.response.text()
  return extractJSON(raw)
}
