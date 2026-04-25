import { Telegraf, Markup } from 'telegraf'
import { supabase } from './supabase.js'
import { log } from './logger.js'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
let bot = null

// In-memory state for multi-step conversations: { telegramId: 'awaiting_employer_name' }
const pendingState = new Map()

export function isTelegramEnabled() {
  return !!BOT_TOKEN
}

export async function initTelegramBot() {
  if (!BOT_TOKEN) {
    log('TELEGRAM_BOT_TOKEN not set — Telegram bot disabled', 'system')
    return
  }

  bot = new Telegraf(BOT_TOKEN)

  bot.start(handleStart)
  bot.on('contact', handleContact)
  bot.command('jobs', handleJobs)
  bot.command('myapps', handleMyApps)
  bot.command('employer', handleEmployerLink)
  bot.on('text', handleText)
  bot.action(/^apply_(.+)$/, handleApplyCallback)
  bot.action(/^link_biz_(.+)$/, async (ctx) => {
    const bizId = ctx.match[1]
    await ctx.answerCbQuery()
    const { data: biz } = await supabase.from('businesses').select('name').eq('id', bizId).single()
    await supabase.from('businesses').update({ telegram_id: ctx.from.id }).eq('id', bizId)
    return ctx.reply(`✅ Уведомления подключены для «${biz?.name}»!`)
  })

  bot.launch().catch(err => log(`Telegram bot launch error: ${err.message}`, 'error'))
  process.once('SIGINT', () => bot.stop('SIGINT'))
  process.once('SIGTERM', () => bot.stop('SIGTERM'))
  log('Telegram bot started', 'success')
}

async function handleStart(ctx) {
  const telegramId = ctx.from.id
  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (applicant) {
    return ctx.reply(
      `Привет, ${applicant.name}! 👋\n\n/jobs — вакансии\n/myapps — мои отклики`,
      Markup.removeKeyboard()
    )
  }

  return ctx.reply(
    'Привет! Я WorkGo — нахожу работу в Актау 🏙\n\nПоделись номером телефона, чтобы подключить аккаунт:',
    Markup.keyboard([[Markup.button.contactRequest('📱 Поделиться номером')]])
      .oneTime()
      .resize()
  )
}

async function handleContact(ctx) {
  const rawPhone = ctx.message.contact.phone_number.replace(/\D/g, '')
  const telegramId = ctx.from.id
  // Prevent account hijacking via forwarded contacts
  if (ctx.message.contact.user_id && ctx.message.contact.user_id !== telegramId) {
    return ctx.reply('Пожалуйста, поделись своим номером, а не чужим.', Markup.removeKeyboard())
  }

  // Normalize to 8-prefix (KZ format used in the DB)
  let phone = rawPhone
  if (rawPhone.length === 11 && rawPhone.startsWith('7')) phone = '8' + rawPhone.slice(1)
  if (rawPhone.length === 12 && rawPhone.startsWith('77')) phone = '8' + rawPhone.slice(2)

  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle()

  if (!applicant) {
    return ctx.reply(
      `Профиль с номером ${phone} не найден.\n\nСоздай профиль на платформе, затем вернись и напиши /start`,
      Markup.removeKeyboard()
    )
  }

  await supabase.from('applicants').update({ telegram_id: telegramId }).eq('id', applicant.id)

  return ctx.reply(
    `✅ Аккаунт подключён! Привет, ${applicant.name}!\n\n/jobs — вакансии\n/myapps — отклики`,
    Markup.removeKeyboard()
  )
}

async function handleJobs(ctx) {
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*, businesses(name, address)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!jobs || jobs.length === 0) {
    return ctx.reply('Вакансий пока нет. Загляни позже!')
  }

  for (const job of jobs) {
    await ctx.reply(formatJobMessage(job), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        Markup.button.callback('Откликнуться 💼', `apply_${job.id}`)
      ])
    })
  }
}

async function handleMyApps(ctx) {
  const telegramId = ctx.from.id
  const { data: applicant } = await supabase
    .from('applicants')
    .select('id')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (!applicant) return ctx.reply('Подключи аккаунт: /start')

  const { data: apps } = await supabase
    .from('applications')
    .select('status, created_at, jobs(title, businesses(name))')
    .eq('applicant_id', applicant.id)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!apps || apps.length === 0) return ctx.reply('Откликов нет. Смотри вакансии: /jobs')

  const STATUS = { pending: '⏳', viewed: '👁', accepted: '✅', rejected: '❌' }
  const lines = apps.map(a => {
    const title = a.jobs?.title || '?'
    const biz = a.jobs?.businesses?.name || '?'
    return `${STATUS[a.status] || '•'} ${title} — ${biz}`
  })
  return ctx.reply(`Твои отклики:\n\n${lines.join('\n')}`)
}

async function handleEmployerLink(ctx) {
  pendingState.set(ctx.from.id, 'awaiting_employer_name')
  return ctx.reply('Введи название своего бизнеса (как на 2GIS):')
}

async function handleText(ctx) {
  const state = pendingState.get(ctx.from.id)
  if (state === 'awaiting_employer_name') {
    pendingState.delete(ctx.from.id)
    const name = ctx.message.text.trim()
    const { data: businesses } = await supabase
      .from('businesses')
      .select('id, name')
      .ilike('name', `%${name}%`)
      .limit(5)

    if (!businesses || businesses.length === 0) {
      return ctx.reply('Бизнес не найден. Убедись, что он добавлен на платформу.')
    }
    if (businesses.length === 1) {
      await supabase
        .from('businesses')
        .update({ telegram_id: ctx.from.id })
        .eq('id', businesses[0].id)
      return ctx.reply(`✅ Уведомления подключены для «${businesses[0].name}»!\nТеперь ты будешь получать сообщения о новых откликах.`)
    }
    // Multiple matches — show inline buttons to pick
    const buttons = businesses.map(b =>
      [Markup.button.callback(b.name, `link_biz_${b.id}`)]
    )
    return ctx.reply('Найдено несколько бизнесов. Выбери свой:', Markup.inlineKeyboard(buttons))
  }
}

async function handleApplyCallback(ctx) {
  const jobId = ctx.match[1]
  const telegramId = ctx.from.id
  await ctx.answerCbQuery()

  const { data: applicant } = await supabase
    .from('applicants')
    .select('id, name')
    .eq('telegram_id', telegramId)
    .maybeSingle()

  if (!applicant) return ctx.reply('Сначала подключи аккаунт: /start')

  const { error } = await supabase
    .from('applications')
    .insert({ job_id: jobId, applicant_id: applicant.id, cover_message: 'Отклик через Telegram' })

  if (error) {
    if (error.code === '23505') return ctx.reply('Ты уже откликался на эту вакансию.')
    return ctx.reply('Ошибка при отклике. Попробуй на сайте.')
  }

  notifyEmployerNewApplicationInternal(jobId, applicant.name).catch(() => {})
  return ctx.reply('✅ Отклик отправлен!')
}

// ── Notification helpers ──────────────────────────────────────────

export function formatJobMessage(job) {
  const biz = job.businesses || {}
  const TYPE = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
  return [
    `<b>${job.title || 'Вакансия'}</b>`,
    biz.name ? `🏢 ${biz.name}` : null,
    job.salary ? `💰 ${job.salary}` : null,
    job.employment_type ? `⏰ ${TYPE[job.employment_type] || job.employment_type}` : null,
    biz.address ? `📍 ${biz.address}` : null,
    job.requirements ? `\nТребования: ${job.requirements}` : null,
  ].filter(Boolean).join('\n')
}

async function notifyEmployerNewApplicationInternal(jobId, applicantName) {
  if (!bot) return
  const { data: job } = await supabase
    .from('jobs')
    .select('title, businesses(telegram_id, name)')
    .eq('id', jobId)
    .maybeSingle()

  const telegramId = job?.businesses?.telegram_id
  if (!telegramId) return

  await bot.telegram.sendMessage(
    telegramId,
    `📩 Новый отклик!\n\nВакансия: ${job.title || '?'}\nСоискатель: ${applicantName}`
  ).catch(() => {})
}

/**
 * Called from server/routes/applications.js PATCH handler.
 * Notifies applicant when employer changes application status.
 */
export async function notifyApplicantStatusChange(applicantId, jobTitle, newStatus) {
  if (!bot) return
  const { data: applicant } = await supabase
    .from('applicants')
    .select('telegram_id')
    .eq('id', applicantId)
    .maybeSingle()

  if (!applicant?.telegram_id) return

  const MSG = {
    viewed: '👁 Работодатель просмотрел твой отклик',
    accepted: '✅ Поздравляем! Работодатель принял тебя на работу',
    rejected: '❌ По этой вакансии получен отказ',
  }
  const text = MSG[newStatus]
  if (!text) return

  await bot.telegram.sendMessage(
    applicant.telegram_id,
    `📌 Обновление отклика\n\nВакансия: ${jobTitle}\n${text}`
  ).catch(() => {})
}

/**
 * Called from server/routes/applications.js POST handler (web applies).
 * Notifies employer when a new application arrives from the website.
 */
export async function notifyEmployerNewApplication(jobId, applicantName) {
  return notifyEmployerNewApplicationInternal(jobId, applicantName)
}

/**
 * Called from server/agent.js when collection_complete = true.
 * Broadcasts new job to all applicants who have linked Telegram.
 */
export async function notifyNewJobToSubscribers(job, businessName) {
  if (!bot) return
  if (job.telegram_notified_at) return  // already sent, avoid duplicates

  const { data: applicants } = await supabase
    .from('applicants')
    .select('telegram_id, employment_type')
    .not('telegram_id', 'is', null)

  if (!applicants || applicants.length === 0) return

  // Filter: send to applicants whose preferred type matches (or they have no preference)
  const targets = job.employment_type
    ? applicants.filter(a => !a.employment_type || a.employment_type === job.employment_type)
    : applicants

  const TYPE = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
  const text = [
    `🔔 <b>Новая вакансия!</b>`,
    ``,
    `<b>${job.title || 'Вакансия'}</b>`,
    `🏢 ${businessName}`,
    job.salary ? `💰 ${job.salary}` : null,
    job.employment_type ? `⏰ ${TYPE[job.employment_type]}` : null,
    ``,
    `/jobs — смотреть все вакансии`,
  ].filter(s => s !== null).join('\n')

  await Promise.allSettled(
    targets.map(a => bot.telegram.sendMessage(a.telegram_id, text, { parse_mode: 'HTML' }).catch(() => {}))
  )

  // Mark job as notified to avoid re-sending
  await supabase
    .from('jobs')
    .update({ telegram_notified_at: new Date().toISOString() })
    .eq('id', job.id)
}
