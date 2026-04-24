import { supabase } from './supabase.js'
import { processMessage } from './gemini.js'
import { sendMessage } from './whatsapp.js'

function buildFirstMessage(businessName) {
  return (
    `Здравствуйте! Меня зовут Айдар, я представляю бесплатную платформу занятости для бизнесов Актау.\n` +
    `Увидел ваш бизнес «${businessName}» на 2GIS. Помогаем быстро найти сотрудников — бесплатно.\n` +
    `У вас есть открытые вакансии? 🙂`
  )
}

/**
 * Send the first WhatsApp message to a DISCOVERED business.
 * Updates status → CONTACTED and stores wa_chat_id.
 */
export async function contactBusiness(businessId) {
  const { data: business, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single()

  if (error || !business) {
    console.error(`contactBusiness: business ${businessId} not found`)
    return
  }

  if (!business.phone) {
    console.warn(`contactBusiness: no phone for "${business.name}" — skipping`)
    return
  }

  const firstMessage = buildFirstMessage(business.name)

  let waChatId
  try {
    waChatId = await sendMessage(business.phone, firstMessage)
  } catch (err) {
    console.error(`contactBusiness: failed to send to "${business.name}":`, err.message)
    return
  }

  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'agent',
    content: firstMessage,
  })

  await supabase
    .from('businesses')
    .update({
      status: 'CONTACTED',
      wa_chat_id: waChatId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', businessId)

  console.log(`📨 Contacted: ${business.name} (${waChatId})`)
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
    console.error(`processIncomingMessage: business ${businessId} not found`)
    return
  }

  // 2. Save incoming message
  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'business',
    content: incomingText,
  })

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

  // 5. Call Gemini
  let geminiResponse
  try {
    geminiResponse = await processMessage(business, history || [], incomingText, currentJob)
  } catch (err) {
    console.error(`Gemini error for "${business.name}":`, err.message)
    // Send a neutral fallback so the conversation doesn't go silent
    const fallback = 'Извините, у нас небольшие технические шалости 😅 Напишите чуть позже, разберёмся!'
    try { await sendMessage(business.phone, fallback) } catch (_) {}
    return
  }

  const { extracted, next_message, next_state, collection_complete } = geminiResponse

  // 6. Update business status
  await supabase
    .from('businesses')
    .update({ status: next_state, updated_at: new Date().toISOString() })
    .eq('id', businessId)

  // 7. Upsert job data if Gemini extracted anything
  const hasExtracted =
    extracted &&
    (extracted.title || extracted.salary || extracted.employment_type || extracted.requirements)

  if (hasExtracted) {
    if (currentJob) {
      const patch = {}
      if (extracted.title) patch.title = extracted.title
      if (extracted.salary) patch.salary = extracted.salary
      if (extracted.employment_type) patch.employment_type = extracted.employment_type
      if (extracted.requirements) patch.requirements = extracted.requirements
      if (collection_complete) patch.status = 'active'
      await supabase.from('jobs').update(patch).eq('id', currentJob.id)
    } else {
      await supabase.from('jobs').insert({
        business_id: businessId,
        title: extracted.title || null,
        salary: extracted.salary || null,
        employment_type: extracted.employment_type || null,
        requirements: extracted.requirements || null,
        location: 'Актау',
        status: 'active',
      })
    }
  }

  // 8. Save agent reply
  await supabase.from('messages').insert({
    business_id: businessId,
    role: 'agent',
    content: next_message,
  })

  // 9. Send reply via WhatsApp
  try {
    await sendMessage(business.phone, next_message)
  } catch (err) {
    console.error(`Failed to send reply to "${business.name}":`, err.message)
  }

  if (collection_complete) {
    console.log(`✅ Job collection complete for: ${business.name}`)
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
    console.error('contactAllDiscovered error:', error.message)
    return
  }

  console.log(`🚀 Contacting ${businesses.length} DISCOVERED businesses…`)

  for (const b of businesses) {
    await contactBusiness(b.id)
    // Small delay to avoid flooding WhatsApp
    await new Promise((r) => setTimeout(r, 2000))
  }
}
