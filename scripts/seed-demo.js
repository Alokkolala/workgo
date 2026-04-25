#!/usr/bin/env node
/**
 * Demo seed script — populates Supabase with fake but realistic data:
 *  - 20 real Aktau businesses from the list
 *  - 80 additional fake businesses (various statuses)
 *  - 16 businesses marked COMPLETED with jobs + fake conversation
 *  - The rest scattered across DISCOVERED / CONTACTED / INTERESTED / COLLECTING
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
)

// ── Real businesses from the list ─────────────────────────────────────────────
const REAL_BUSINESSES = [
  { name: 'Urbo Coffee',                      phone: '87772922032', category: 'Кафе/Ресторан',    address: '18-й мкр., здание 7 (ЖК Zelmar Residence)' },
  { name: 'Barista Business',                  phone: '87010182122', category: 'Кафе/Ресторан',    address: '17-й мкр., 6 (ЖК Green Plaza)' },
  { name: 'Coffee Corner',                     phone: null,          category: 'Кафе/Ресторан',    address: '5-й мкр., дом 20' },
  { name: 'La Terrasse City Cafe',             phone: '87005581108', category: 'Кафе/Ресторан',    address: '11-й мкр., здание 8' },
  { name: 'Coutume Coffee',                    phone: '87078012501', category: 'Кафе/Ресторан',    address: '9-й мкр., здание 23А' },
  { name: 'Wave Coffee',                       phone: '87754954433', category: 'Кафе/Ресторан',    address: '5-й мкр., здание 5В' },
  { name: 'Koktem Cafe',                       phone: '87760296303', category: 'Кафе/Ресторан',    address: '19-й мкр., ЖК Туран' },
  { name: 'Coffee Original',                   phone: '87055887108', category: 'Кафе/Ресторан',    address: 'Актау (круглосуточно)' },
  { name: 'Coffee Bus',                        phone: null,          category: 'Кафе/Ресторан',    address: '11-й мкр.' },
  { name: 'Барбершоп "The Cut"',               phone: '87750001414', category: 'Салон красоты',    address: '17-й мкр., здание 1 (БЦ Diplomat)' },
  { name: 'Салон красоты "Z-Beauty"',          phone: '87015557017', category: 'Салон красоты',    address: '14-й мкр., здание 62' },
  { name: 'OldBoy Barbershop',                 phone: '87084308010', category: 'Салон красоты',    address: '17-й мкр., 19' },
  { name: 'Языковая школа "Grand Education"',  phone: '87024413535', category: 'Образование',      address: '11-й мкр., здание 45/1' },
  { name: 'Учебный центр "Bolashaq School"',   phone: '87084301010', category: 'Образование',      address: '17-й мкр., ЖК Green Plaza' },
  { name: 'IT-школа "Digital Wave"',           phone: '87079112030', category: 'Образование',      address: '16-й мкр., здание 11' },
  { name: 'Цветочный салон "Romantic"',        phone: '87015326845', category: 'Магазин/Розница',  address: '7-й мкр., здание 7/1' },
  { name: 'Магазин подарков "Joy Aktau"',      phone: '87751112233', category: 'Магазин/Розница',  address: '12-й мкр., здание 21' },
  { name: 'Бизнес-центр "Diplomat"',           phone: '87754247979', category: 'Бизнес-центр',     address: '17-й мкр., здание 1' },
  { name: 'Палата предпринимателей "Атамекен"',phone: '87292304040', category: 'Организация',      address: '35-й мкр., здание Палаты' },
  { name: 'БЦ "Капитал"',                     phone: null,          category: 'Бизнес-центр',     address: '12-й мкр., здание 79' },
]

// ── Jobs for each COMPLETED business (first 16) ───────────────────────────────
const JOBS_BY_NAME = {
  'Urbo Coffee':                      { title: 'Бариста', salary: '150 000–200 000 ₸', employment_type: 'full', requirements: 'Опыт от 6 мес., знание кофе-напитков' },
  'Barista Business':                 { title: 'Бариста / кассир', salary: '130 000–160 000 ₸', employment_type: 'full', requirements: 'Коммуникабельность, обучим' },
  'Coffee Corner':                    { title: 'Официант', salary: '120 000 ₸ + чаевые', employment_type: 'full', requirements: 'Ответственность, опрятный вид' },
  'La Terrasse City Cafe':            { title: 'Повар горячего цеха', salary: '200 000–250 000 ₸', employment_type: 'full', requirements: 'Опыт от 1 года, знание казахской и европейской кухни' },
  'Coutume Coffee':                   { title: 'Помощник бариста', salary: '110 000 ₸', employment_type: 'part', requirements: 'Студенты приветствуются, гибкий график' },
  'Wave Coffee':                      { title: 'Кассир-бариста', salary: '140 000 ₸', employment_type: 'full', requirements: 'Обучение за счёт компании' },
  'Koktem Cafe':                      { title: 'Официант / хостес', salary: '120 000 ₸ + чаевые', employment_type: 'full', requirements: 'Приятная внешность, грамотная речь' },
  'Coffee Original':                  { title: 'Ночной администратор', salary: '160 000 ₸', employment_type: 'full', requirements: 'Опыт в общепите, стрессоустойчивость' },
  'Coffee Bus':                       { title: 'Оператор кофе-точки', salary: '130 000 ₸', employment_type: 'gig', requirements: 'Без опыта, обучаем, гибкий график' },
  'Барбершоп "The Cut"':              { title: 'Барбер / мастер мужских стрижек', salary: '200 000–350 000 ₸', employment_type: 'full', requirements: 'Диплом парикмахера, портфолио' },
  'Салон красоты "Z-Beauty"':         { title: 'Мастер маникюра / педикюра', salary: '180 000–280 000 ₸', employment_type: 'full', requirements: 'Сертификат, опыт от 1 года' },
  'OldBoy Barbershop':                { title: 'Барбер', salary: '250 000 ₸ (% от выручки)', employment_type: 'full', requirements: 'Опыт от 2 лет, свои инструменты' },
  'Языковая школа "Grand Education"': { title: 'Преподаватель английского языка', salary: '170 000–220 000 ₸', employment_type: 'part', requirements: 'Уровень B2+, опыт преподавания' },
  'Учебный центр "Bolashaq School"':  { title: 'Педагог начальных классов', salary: '160 000 ₸', employment_type: 'full', requirements: 'Педагогическое образование' },
  'IT-школа "Digital Wave"':          { title: 'Инструктор по программированию', salary: '200 000–300 000 ₸', employment_type: 'part', requirements: 'Python / JS, опыт работы с детьми' },
  'Цветочный салон "Romantic"':       { title: 'Флорист', salary: '150 000–200 000 ₸', employment_type: 'full', requirements: 'Опыт от 1 года, чувство вкуса' },
}

// ── Fake extra businesses to reach 100 total ──────────────────────────────────
const EXTRA_BUSINESSES = [
  { name: 'Кафе "Каспий"',            category: 'Кафе/Ресторан',   address: '3-й мкр.' },
  { name: 'Ресторан "Актау"',          category: 'Кафе/Ресторан',   address: '4-й мкр., здание 12' },
  { name: 'Суши-бар "Tokyo"',          category: 'Кафе/Ресторан',   address: '6-й мкр.' },
  { name: 'Пиццерия "Pronto"',         category: 'Кафе/Ресторан',   address: '8-й мкр.' },
  { name: 'Бургерная "BigBoy"',        category: 'Кафе/Ресторан',   address: '10-й мкр.' },
  { name: 'Кафе "Нур"',               category: 'Кафе/Ресторан',   address: '13-й мкр.' },
  { name: 'Столовая "Домашняя"',       category: 'Кафе/Ресторан',   address: '15-й мкр.' },
  { name: 'Самса "Гурман"',            category: 'Кафе/Ресторан',   address: '20-й мкр.' },
  { name: 'Кофейня "Morgen"',          category: 'Кафе/Ресторан',   address: '22-й мкр.' },
  { name: 'Кафе "Берег"',             category: 'Кафе/Ресторан',   address: 'Приморский бульвар' },
  { name: 'Ресторан "Zafran"',         category: 'Кафе/Ресторан',   address: '7-й мкр.' },
  { name: 'Фастфуд "Speed"',           category: 'Кафе/Ресторан',   address: '9-й мкр.' },
  { name: 'Кафе "Алия"',              category: 'Кафе/Ресторан',   address: '21-й мкр.' },
  { name: 'Пекарня "Bread Lab"',       category: 'Кафе/Ресторан',   address: '11-й мкр.' },
  { name: 'Чайхана "Дастархан"',       category: 'Кафе/Ресторан',   address: '14-й мкр.' },
  { name: 'Кафе "Орбита"',            category: 'Кафе/Ресторан',   address: '16-й мкр.' },
  { name: 'Суши "Sakura"',             category: 'Кафе/Ресторан',   address: '18-й мкр.' },
  { name: 'Кофе "ЗерноGo"',           category: 'Кафе/Ресторан',   address: '2-й мкр.' },
  { name: 'Столовая "Офис"',           category: 'Кафе/Ресторан',   address: '1-й мкр.' },
  { name: 'Ресторан "Tengri"',         category: 'Кафе/Ресторан',   address: '31-й мкр.' },
  { name: 'Студия красоты "Lola"',     category: 'Салон красоты',   address: '5-й мкр.' },
  { name: 'Ногтевая студия "Nails+"',  category: 'Салон красоты',   address: '6-й мкр.' },
  { name: 'Парикмахерская "Стиль"',    category: 'Салон красоты',   address: '8-й мкр.' },
  { name: 'Барбершоп "Sharp"',         category: 'Салон красоты',   address: '10-й мкр.' },
  { name: 'СПА-салон "Relax"',         category: 'Салон красоты',   address: '12-й мкр.' },
  { name: 'Студия бровей "Arch"',      category: 'Салон красоты',   address: '13-й мкр.' },
  { name: 'Салон "Эстетика"',          category: 'Салон красоты',   address: '15-й мкр.' },
  { name: 'Тату-студия "Ink"',         category: 'Салон красоты',   address: '17-й мкр.' },
  { name: 'Курсы казахского "TilStar"',category: 'Образование',     address: '9-й мкр.' },
  { name: 'Школа рисования "Palitra"', category: 'Образование',     address: '11-й мкр.' },
  { name: 'Детский клуб "Солнышко"',   category: 'Образование',     address: '14-й мкр.' },
  { name: 'Курсы английского "Oxford"',category: 'Образование',     address: '16-й мкр.' },
  { name: 'Репетитор-центр "Ас"',      category: 'Образование',     address: '18-й мкр.' },
  { name: 'Школа танцев "Move"',       category: 'Образование',     address: '20-й мкр.' },
  { name: 'Магазин "Мода"',           category: 'Магазин/Розница', address: '3-й мкр.' },
  { name: 'Магазин "Electronics+"',   category: 'Магазин/Розница', address: '5-й мкр.' },
  { name: 'Бутик "Glamour"',          category: 'Магазин/Розница', address: '7-й мкр.' },
  { name: 'Аптека "Здоровье"',        category: 'Магазин/Розница', address: '9-й мкр.' },
  { name: 'Зоомагазин "Лапка"',       category: 'Магазин/Розница', address: '10-й мкр.' },
  { name: 'Книжный "Ориентир"',       category: 'Магазин/Розница', address: '11-й мкр.' },
  { name: 'Оптика "Взгляд"',          category: 'Магазин/Розница', address: '12-й мкр.' },
  { name: 'Магазин "SneakerZone"',    category: 'Магазин/Розница', address: '13-й мкр.' },
  { name: 'Магазин "KidStyle"',       category: 'Магазин/Розница', address: '15-й мкр.' },
  { name: 'Спортмаг "ActiveLife"',    category: 'Магазин/Розница', address: '16-й мкр.' },
  { name: 'Супермаркет "Aroma"',      category: 'Магазин/Розница', address: '17-й мкр.' },
  { name: 'Канцтовары "Карандаш"',    category: 'Магазин/Розница', address: '19-й мкр.' },
  { name: 'Магазин сувениров "Актау"',category: 'Магазин/Розница', address: '4-й мкр.' },
  { name: 'Игрушки "Детская планета"',category: 'Магазин/Розница', address: '6-й мкр.' },
  { name: 'СТО "Мастер"',             category: 'СТО/Автосервис',  address: '2-й мкр.' },
  { name: 'Автосервис "Drive"',        category: 'СТО/Автосервис',  address: '4-й мкр.' },
  { name: 'Шиномонтаж "Колесо"',      category: 'СТО/Автосервис',  address: '8-й мкр.' },
  { name: 'Автомойка "Блеск"',         category: 'СТО/Автосервис',  address: '10-й мкр.' },
  { name: 'Автозапчасти "MaxAuto"',    category: 'СТО/Автосервис',  address: '11-й мкр.' },
  { name: 'СТО "АвтоПрофи"',          category: 'СТО/Автосервис',  address: '14-й мкр.' },
  { name: 'Детейлинг "Глянец"',        category: 'СТО/Автосервис',  address: '16-й мкр.' },
  { name: 'Тонировка "DarkStyle"',     category: 'СТО/Автосервис',  address: '18-й мкр.' },
  { name: 'Фитнес-клуб "Energy"',      category: 'Спорт/Фитнес',   address: '6-й мкр.' },
  { name: 'Спортзал "Titan"',          category: 'Спорт/Фитнес',   address: '9-й мкр.' },
  { name: 'Йога-студия "Balance"',     category: 'Спорт/Фитнес',   address: '12-й мкр.' },
  { name: 'Боксёрский клуб "Champion"',category: 'Спорт/Фитнес',   address: '15-й мкр.' },
  { name: 'Бассейн "Aqua"',            category: 'Спорт/Фитнес',   address: '3-й мкр.' },
  { name: 'Клуб единоборств "Fight"',  category: 'Спорт/Фитнес',   address: '20-й мкр.' },
  { name: 'Медцентр "Семья"',          category: 'Медицина',        address: '7-й мкр.' },
  { name: 'Стоматология "Улыбка"',     category: 'Медицина',        address: '11-й мкр.' },
  { name: 'Клиника "Здоровье плюс"',   category: 'Медицина',        address: '14-й мкр.' },
  { name: 'Ветклиника "Друг"',         category: 'Медицина',        address: '17-й мкр.' },
  { name: 'Массаж "Релакс"',           category: 'Медицина',        address: '5-й мкр.' },
  { name: 'Грузоперевозки "Надёжный"', category: 'Логистика',       address: 'Промзона' },
  { name: 'Доставка "Скорый"',         category: 'Логистика',       address: 'Промзона' },
  { name: 'Склад "StorePro"',          category: 'Логистика',       address: 'Промзона' },
  { name: 'Агентство "КомпасМедиа"',   category: 'Маркетинг',       address: '9-й мкр.' },
  { name: 'SMM-студия "Buzz"',          category: 'Маркетинг',       address: '11-й мкр.' },
  { name: 'Типография "Принт+"',        category: 'Маркетинг',       address: '13-й мкр.' },
  { name: 'IT-компания "CodeTeam"',    category: 'IT',              address: '16-й мкр.' },
  { name: 'Веб-студия "Pixel"',        category: 'IT',              address: '17-й мкр.' },
  { name: 'Бухгалтерия "Баланс"',      category: 'Бизнес-центр',   address: '18-й мкр.' },
  { name: 'Юридическая "Закон"',       category: 'Бизнес-центр',   address: '12-й мкр.' },
  { name: 'Страхование "Доверие"',     category: 'Бизнес-центр',   address: '14-й мкр.' },
]

// ── Fake conversation templates ───────────────────────────────────────────────
function fakeConversation(bizName, job) {
  return [
    {
      role: 'agent',
      content: `Здравствуйте! Меня зовут Алихан, я представляю платформу WorkGo — помогаем бизнесу в Актау находить сотрудников. Скажите, в «${bizName}» сейчас ищете кого-нибудь из персонала?`,
    },
    {
      role: 'business',
      content: 'Да, нам нужен сотрудник.',
    },
    {
      role: 'agent',
      content: 'Отлично! Расскажите подробнее — на какую должность ищете и какая будет зарплата?',
    },
    {
      role: 'business',
      content: `Ищем ${job.title}. Зарплата ${job.salary}.`,
    },
    {
      role: 'agent',
      content: `Понял, ${job.title} с зарплатой ${job.salary}. Какой тип занятости — полная, частичная или проектная?`,
    },
    {
      role: 'business',
      content: job.employment_type === 'full' ? 'Полная занятость.' : job.employment_type === 'part' ? 'Частичная, можно совмещать.' : 'Проектная работа.',
    },
    {
      role: 'agent',
      content: 'Есть ли особые требования к кандидату?',
    },
    {
      role: 'business',
      content: job.requirements,
    },
    {
      role: 'agent',
      content: `Спасибо! Вакансия «${job.title}» успешно сохранена. Мы начнём подбор кандидатов — первые отклики пришлём вам в WhatsApp. Удачного дня! 🎯`,
    },
  ]
}

// ── Status distribution for non-completed businesses ─────────────────────────
const STATUS_POOL = [
  ...Array(35).fill('DISCOVERED'),
  ...Array(25).fill('CONTACTED'),
  ...Array(12).fill('INTERESTED'),
  ...Array(8).fill('COLLECTING'),
  ...Array(4).fill('REJECTED'),
]

function pickStatus(index) {
  return STATUS_POOL[index % STATUS_POOL.length]
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Starting demo seed...\n')

  // 1. Insert real businesses — first 16 → COMPLETED, rest → varied
  const completedNames = Object.keys(JOBS_BY_NAME)
  const allReal = REAL_BUSINESSES.map((b) => ({
    ...b,
    status: completedNames.includes(b.name) ? 'COMPLETED' : pickStatus(REAL_BUSINESSES.indexOf(b)),
  }))

  // 2. Build extra businesses to reach 100 total
  const needed = 100 - REAL_BUSINESSES.length
  const extraWithStatus = EXTRA_BUSINESSES.slice(0, needed).map((b, i) => ({
    ...b,
    phone: null,
    status: pickStatus(i + 20),
  }))

  const allBusinesses = [...allReal, ...extraWithStatus]

  // Fetch existing business names to avoid duplicates
  const { data: existingBizRows } = await supabase.from('businesses').select('name, id, status')
  const existingNames = new Set((existingBizRows || []).map((b) => b.name))

  const toInsert = allBusinesses.filter((b) => !existingNames.has(b.name))
  console.log(`${existingNames.size} already exist — inserting ${toInsert.length} new businesses...`)

  let insertedBizRows = existingBizRows || []

  if (toInsert.length > 0) {
    const { data: newRows, error: bizError } = await supabase
      .from('businesses')
      .insert(toInsert)
      .select()

    if (bizError) {
      console.error('Business insert error:', bizError.message)
      process.exit(1)
    }
    insertedBizRows = [...insertedBizRows, ...newRows]
  }

  console.log(`✅ Total businesses in DB: ${insertedBizRows.length}`)

  // 3. For each COMPLETED real business → insert job + conversation
  let jobsCreated = 0
  let messagesCreated = 0

  for (const biz of insertedBizRows) {
    const jobSpec = JOBS_BY_NAME[biz.name]
    if (!jobSpec || biz.status !== 'COMPLETED') continue

    // Skip if job already exists for this business
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('business_id', biz.id)
      .limit(1)
      .single()

    if (existingJob) {
      console.log(`  ⏭  Job already exists for ${biz.name}`)
      jobsCreated++
      continue
    }

    // Insert job
    const { data: jobRow, error: jobErr } = await supabase
      .from('jobs')
      .insert([{
        business_id: biz.id,
        title: jobSpec.title,
        salary: jobSpec.salary,
        employment_type: jobSpec.employment_type,
        requirements: jobSpec.requirements,
        location: biz.address || 'Актау',
        description: `Требуется ${jobSpec.title} в ${biz.name}. ${jobSpec.requirements}.`,
        status: 'active',
      }])
      .select()
      .single()

    if (jobErr) {
      console.warn(`  ⚠️  Job upsert for ${biz.name}: ${jobErr.message}`)
    } else {
      jobsCreated++
      console.log(`  💼 Job: ${jobSpec.title} @ ${biz.name}`)
    }

    // Insert fake conversation messages
    const msgs = fakeConversation(biz.name, jobSpec).map((m) => ({
      business_id: biz.id,
      role: m.role,
      content: m.content,
    }))

    const { error: msgErr } = await supabase.from('messages').insert(msgs)
    if (msgErr) {
      console.warn(`  ⚠️  Messages for ${biz.name}: ${msgErr.message}`)
    } else {
      messagesCreated += msgs.length
    }
  }

  console.log(`\n✅ Jobs created: ${jobsCreated}`)
  console.log(`✅ Messages created: ${messagesCreated}`)
  console.log(`\n🎉 Seed complete! Check your Supabase dashboard.`)
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
