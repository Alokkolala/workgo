import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { log } from './logger.js'

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

  log(
    `Gemini <- "${business.name}" | status: ${business.status} | missing: ${missingStr}`,
    'gemini_req', business.id,
    { businessName: business.name, status: business.status, collected, missing, latestMessage }
  )

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

  log(`Gemini -> ${JSON.stringify(parsed)}`, 'gemini_res', business.id, parsed)

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

/**
 * Generate a personalized first WhatsApp message using Gemini system instruction.
 * Returns plain Russian text (NOT JSON). Uses same key-rotation as processMessage().
 * @param {object} business - must have .name and .category
 * @returns {Promise<string>}
 */
export async function generateFirstMessage(business) {
  const systemInstruction = `Ты — вежливый и профессиональный HR-ассистент по имени Алихан. Твоя задача — составить первое сообщение в WhatsApp для владельца бизнеса в Актау.

Твоё сообщение должно строго следовать этому шаблону:
"Добрый день! Это Алихан, представитель новой платформы занятости Мангистау. Мы разрабатываем этот проект совместно с Акиматом, чтобы поддержать малый бизнес нашего города.

Я увидел ваш бизнес [Название] на 2GIS и заметил, что вы работаете в сфере [Категория]. Мы автоматизируем поиск кадров специально для таких компаний в Актау. Если вы начнёте сотрудничать с нами сейчас, на этапе запуска, мы гарантируем, что сервис останется для вас бесплатным навсегда, и мы будем поддерживать ваш проект лично.

Подскажите, есть ли у вас сейчас открытые вакансии для [Профессия в множ. числе] или других сотрудников? Буду рад помочь вам быстро закрыть позицию!"

ПРАВИЛА ПЕРСОНАЛИЗАЦИИ:
1. [Название]: Используй название бизнеса.
2. [Категория]: Сфера деятельности (кафе, салон красоты, СТО и т.д.).
3. [Профессия в множ. числе]:
   - кафе / ресторан / столовая -> официантов/поваров
   - салон красоты / парикмахерская -> мастеров/стилистов
   - СТО / автосервис -> автомехаников
   - магазин / торговая точка -> продавцов/кассиров
   - стройкомпания / строительство -> строителей/прорабов
   - аптека / медицина -> фармацевтов/медработников
   - другие -> сотрудников

Тон: Официально-дружелюбный, без лишней "роботизированности".
Язык: Русский.
Выдавай ТОЛЬКО текст сообщения, без лишних комментариев.`

  const userInput = `Название бизнеса: ${business.name}\nКатегория: ${business.category || 'бизнес'}`

  let raw = null
  let lastError = null

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const key   = apiKeys[currentKeyIndex]
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction })
      const result = await model.generateContent(userInput)
      raw = result.response.text().trim()
      console.log(`✓ generateFirstMessage succeeded on key index ${currentKeyIndex}`)
      break
    } catch (err) {
      lastError = err
      console.warn(`⚠️  generateFirstMessage attempt ${attempt}/3 failed: ${err.message}`)
      if (
        attempt < 3 &&
        (err.message.includes('API_KEY_INVALID') ||
          err.message.includes('RESOURCE_EXHAUSTED') ||
          err.message.includes('403'))
      ) {
        const next = (currentKeyIndex + 1) % apiKeys.length
        if (next !== currentKeyIndex) {
          console.log(`🔄 Rotating to key ${next}`)
          currentKeyIndex = next
        }
      }
      if (attempt < 3) await new Promise(r => setTimeout(r, 2000))
    }
  }

  if (!raw) throw new Error(`generateFirstMessage failed after 3 attempts: ${lastError?.message}`)
  return raw
}
