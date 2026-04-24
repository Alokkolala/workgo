import { supabase } from './supabase.js'
import { processMessage, generateFirstMessage } from './gemini.js'
import { sendMessage } from './whatsapp.js'
import { log } from './logger.js'

/**
 * Send the first WhatsApp message to a DISCOVERED business.
 * Uses Gemini to generate a personalized message based on name + category.
 * Falls back to a simple template if Gemini fails.
 * Updates status → CONTACTED and stores wa_chat_id.
 */
export async function contactBusiness(businessId) {
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (error || !business) {
    log(`contactBusiness: business ${businessId} not found`, 'error')
    return
  }

  if (!business.phone) {
    log(`No phone for "${business.name}" — skipping`, 'warn', businessId)
    return
  }

  log(`Generating personalized first message for "${business.name}" (${business.category || '?'})…`, 'system', businessId)

  let firstMessage
  try {
    firstMessage = await generateFirstMessage(business)
  } catch (err) {
    log(`Gemini failed, using fallback: ${err.message}`, 'warn', businessId)
    firstMessage =
      `Добрый день! Это Алихан, представитель платформы занятости Мангистау.\n` +
      `Увидел ваш бизнес «${business.name}» на 2GIS. Есть ли у вас открытые вакансии?`
  }

  log(`WA OUT -> ${business.phone}: ${firstMessage}`, 'wa_out', businessId, { phone: business.phone, message: firstMessage })

  let waChatId
  try {
    waChatId = await sendMessage(business.phone, firstMessage)
  } catch (err) {
    log(`Failed to send to "${business.name}": ${err.message}`, 'error', businessId)
    return
  }

  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'agent',
    content: firstMessage,
  })
  log(`DB: saved outgoing message for "${business.name}"`, 'db', businessId)

  await supabase
    .from('businesses')
    .update({ status: 'CONTACTED', wa_chat_id: waChatId, updated_at: new Date().toISOString() })
    .eq('id', businessId)
  log(`State: DISCOVERED -> CONTACTED ("${business.name}")`, 'state', businessId, { from: 'DISCOVERED', to: 'CONTACTED' })
}

/**
 * Process an incoming reply from a business owner.
 * Runs the full agent loop: save → Gemini → update DB → reply via WA.
 */
export async function processIncomingMessage(businessId, incomingText) {
  // 1. Load business
  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (bizErr || !business) {
    log(`processIncomingMessage: business ${businessId} not found`, 'error')
    return
  }

  // 2. Log + save incoming message
  log(`WA IN <- "${business.name}": ${incomingText}`, 'wa_in', businessId, { message: incomingText })

  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'business',
    content: incomingText,
  })
  log(`DB: saved incoming message from "${business.name}"`, 'db', businessId)

  // 3. Load full message history
  const { data: history } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  // 4. Load existing job record for this business (if any)
  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('business_id', businessId)
    .limit(1)

  const currentJob = existingJobs && existingJobs.length > 0 ? existingJobs[0] : null

  // 5. Call Gemini (request/response logged inside processMessage)
  let geminiResponse
  try {
    geminiResponse = await processMessage(business, history || [], incomingText, currentJob)
  } catch (err) {
    log(`Gemini error for "${business.name}": ${err.message}`, 'error', businessId)
    const fallback = 'Извините, у нас небольшие технические шалости. Напишите чуть позже!'
    try { await sendMessage(business.phone, fallback) } catch (e) {
      log(`Could not send fallback to "${business.name}": ${e.message}`, 'warn', businessId)
    }
    return
  }

  const { extracted, next_message, next_state, collection_complete } = geminiResponse
  const prevStatus = business.status

  // 6. Update business status
  await supabase
    .from('businesses')
    .update({ status: next_state, updated_at: new Date().toISOString() })
    .eq('id', businessId)
  log(`State: ${prevStatus} -> ${next_state} ("${business.name}")`, 'state', businessId, { from: prevStatus, to: next_state })

  // 7. Upsert job data if Gemini extracted anything
  const hasExtracted =
    extracted &&
    (extracted.title || extracted.salary || extracted.employment_type || extracted.requirements)

  if (hasExtracted) {
    if (currentJob) {
      const patch = {}
      if (extracted.title)           patch.title           = extracted.title
      if (extracted.salary)          patch.salary          = extracted.salary
      if (extracted.employment_type) patch.employment_type = extracted.employment_type
      if (extracted.requirements)    patch.requirements    = extracted.requirements
      if (collection_complete)       patch.status          = 'active'
      await supabase.from('jobs').update(patch).eq('id', currentJob.id)
      log(`DB: updated job for "${business.name}" — ${JSON.stringify(patch)}`, 'db', businessId, patch)
    } else {
      const jobData = {
        business_id:     businessId,
        title:           extracted.title           || null,
        salary:          extracted.salary          || null,
        employment_type: extracted.employment_type || null,
        requirements:    extracted.requirements    || null,
        location: 'Актау',
        status: 'active',
      }
      await supabase.from('jobs').insert(jobData)
      log(`DB: created job for "${business.name}" — ${JSON.stringify(extracted)}`, 'db', businessId, extracted)
    }
  }

  // 8. Save + send agent reply
  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'agent',
    content: next_message,
  })
  log(`WA OUT -> "${business.name}": ${next_message}`, 'wa_out', businessId, { message: next_message })

  try {
    await sendMessage(business.phone, next_message)
  } catch (err) {
    log(`Failed to send reply to "${business.name}": ${err.message}`, 'error', businessId)
  }

  if (collection_complete) {
    log(`Job collection COMPLETE for: ${business.name}`, 'success', businessId)
  }
}

/**
 * Contact all DISCOVERED businesses that have a phone number.
 * Safe to call multiple times — only touches DISCOVERED rows.
 */
export async function contactAllDiscovered() {
  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('status', 'DISCOVERED')
    .not('phone', 'is', null)

  if (error) {
    log(`contactAllDiscovered error: ${error.message}`, 'error')
    return
  }

  log(`Contacting ${businesses.length} DISCOVERED businesses…`, 'system')
  for (const b of businesses) {
    await contactBusiness(b.id)
    await new Promise((r) => setTimeout(r, 2000))
  }
}
