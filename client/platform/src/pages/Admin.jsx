import { useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '../lib/supabase.js'
import BusinessRow from '../components/BusinessRow.jsx'
import TopBar from '../components/TopBar.jsx'
import WAMessage from '../components/WAMessage.jsx'
import {
  contactAll,
  contactBusiness,
  getBusinesses,
  getBusinessStats,
  getHealth,
  getLatestBusinessJob,
  getMessages,
  runScraper,
} from '../api.js'
import { filterBusinesses, STATUS_LABEL, getBusinessInitials } from './admin.helpers.js'

const LOG_COLOR = {
  wa_in: '#d97706',
  wa_out: '#2563eb',
  gemini_req: '#0d9488',
  gemini_res: '#059669',
  state: '#4f46e5',
  db: '#7c3aed',
  success: '#16a34a',
  error: '#dc2626',
  system: '#6b7280',
  scraper: '#0891b2',
}

export default function Admin() {
  const [businesses, setBusinesses] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [job, setJob] = useState(null)
  const [stats, setStats] = useState({})
  const [waOnline, setWaOnline] = useState(false)
  const [query, setQuery] = useState('')
  const [logs, setLogs] = useState([])
  const [contacting, setContacting] = useState(false)
  const chatEndRef = useRef(null)
  const eventsRef = useRef(null)

  useEffect(() => {
    getBusinesses().then((result) => setBusinesses(result.data || []))
    getBusinessStats().then((result) => setStats(result.counts || {}))
    getHealth().then((result) => setWaOnline(Boolean(result.whatsapp)))

    eventsRef.current = new EventSource('/api/logs')
    eventsRef.current.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        setLogs((current) => [
          ...current.slice(-199),
          {
            ...payload,
            ts: new Date().toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          },
        ])
      } catch {
        // ignore malformed log events
      }
    }

    return () => {
      eventsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      return undefined
    }

    const channel = supabase
      .channel('admin-businesses')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setBusinesses((current) => [payload.new, ...current])
          return
        }

        if (payload.eventType === 'UPDATE') {
          setBusinesses((current) =>
            current.map((business) => (business.id === payload.new.id ? { ...business, ...payload.new } : business))
          )
          setSelected((current) => (current?.id === payload.new.id ? { ...current, ...payload.new } : current))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!supabase || !selected?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`admin-messages-${selected.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `business_id=eq.${selected.id}` },
        (payload) => {
          setMessages((current) => [...current, payload.new])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selected?.id])

  useEffect(() => {
    if (!supabase || !selected?.id) {
      return undefined
    }

    const channel = supabase
      .channel(`admin-jobs-${selected.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `business_id=eq.${selected.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setJob(payload.new)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selected?.id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function selectBusiness(business) {
    setSelected(business)
    setMessages([])
    setJob(null)

    const [messageResult, jobResult] = await Promise.all([
      getMessages(business.id),
      getLatestBusinessJob(business.id),
    ])

    setMessages(messageResult.messages || [])
    setJob(Array.isArray(jobResult) ? jobResult[0] || null : null)
  }

  async function handleContact() {
    if (!selected) {
      return
    }

    setContacting(true)
    await contactBusiness(selected.id)
    setContacting(false)
  }

  const filtered = useMemo(() => filterBusinesses(businesses, query), [businesses, query])

  return (
    <div className="page">
      <TopBar context="админ" />

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 280px', minHeight: 0, overflow: 'hidden' }}>
        <aside className="wf-sidebar">
          <div className="wf-stack" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', gap: 10 }}>
            <div className="between">
              <div className="h-eyebrow">Компании · WhatsApp</div>
              <span className={`badge ${waOnline ? 'ok' : ''}`}>
                {waOnline ? '● agent online' : '○ agent offline'}
              </span>
            </div>

            <div className="input" style={{ height: 30 }}>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по компании..."
                style={{ fontSize: 11 }}
              />
            </div>

            <div className="wf-toolbar">
              {Object.entries(stats).map(([status, count]) => (
                <span key={status} className="chip" style={{ fontSize: 9, padding: '2px 7px' }}>
                  {status} · {count}
                </span>
              ))}
            </div>

            <div className="wf-toolbar">
              <button type="button" className="btn sm ghost flex-1" onClick={() => runScraper('')}>
                🔍 Скрапер
              </button>
              <button type="button" className="btn sm ghost flex-1" onClick={() => contactAll()}>
                📢 Всем
              </button>
            </div>
          </div>

          <div className="no-scroll" style={{ overflow: 'auto', flex: 1 }}>
            {filtered.map((business) => (
              <BusinessRow
                key={business.id}
                business={business}
                selected={selected?.id === business.id}
                onClick={() => selectBusiness(business)}
              />
            ))}
          </div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {selected ? (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  background: '#f0f2f5',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div className="row gap-10" style={{ alignItems: 'center' }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--muted)',
                    }}
                  >
                    {getBusinessInitials(selected.name)}
                  </div>

                  <div className="wf-stack" style={{ gap: 4 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{selected.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      {[selected.phone, STATUS_LABEL[selected.status] || selected.status].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>

                <div className="wf-toolbar">
                  <span className={`badge ${selected.status === 'COMPLETED' ? 'ok' : selected.status === 'COLLECTING' ? 'ai' : ''}`}>
                    {selected.status}
                  </span>
                  <button type="button" className="btn sm" onClick={handleContact} disabled={contacting}>
                    {contacting ? '▶ Работаю...' : '▶ Написать'}
                  </button>
                </div>
              </div>

              <div className="wf-chat-bg no-scroll" style={{ padding: '12px 16px', overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {messages.length === 0 ? (
                  <div className="center flex-1">
                    <div className="wf-empty" style={{ maxWidth: 360 }}>
                      Сообщений пока нет. Нажмите «Написать», чтобы агент начал диалог.
                    </div>
                  </div>
                ) : (
                  messages.map((message) => <WAMessage key={message.id} message={message} />)
                )}

                {selected && messages.length > 0 ? (
                  <div
                    style={{
                      alignSelf: 'center',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--muted)',
                      background: 'rgba(255,255,255,0.6)',
                      padding: '4px 8px',
                      borderRadius: 4,
                      marginTop: 2,
                    }}
                  >
                    ✦ AI печатает...
                  </div>
                ) : null}

                <div ref={chatEndRef} />
              </div>

              <div style={{ padding: 10, background: '#f0f2f5', borderTop: '1px solid var(--line)' }}>
                <div className="wf-panel" style={{ background: '#fffcf0', borderColor: 'var(--accent)' }}>
                  <div className="h-eyebrow" style={{ color: 'var(--accent-ink)' }}>✦ Черновик AI · ждёт одобрения</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Следующее сообщение формируется агентом по данным вакансии и последнему ответу компании.
                  </div>
                  <div className="wf-toolbar" style={{ marginTop: 8 }}>
                    <button type="button" className="btn sm">✓ Отправить</button>
                    <button type="button" className="btn ghost sm">Редактировать</button>
                    <button type="button" className="btn ghost sm">Не отправлять</button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="center flex-1 wf-chat-bg">
              <div className="wf-empty" style={{ maxWidth: 360 }}>
                <div style={{ color: 'var(--ink)', marginBottom: 8 }}>Выберите компанию слева</div>
                <div className="wf-note">Откроется живая переписка агента и панель извлечённой вакансии.</div>
              </div>
            </div>
          )}
        </section>

        <aside className="wf-sidebar" style={{ borderRight: 'none', borderLeft: '1px solid var(--line)' }}>
          <div className="wf-stack" style={{ padding: 14, borderBottom: '1px solid var(--line)', gap: 10 }}>
            <div className="h-eyebrow">Извлечено агентом · → БД</div>

            {job ? (
              <div className="wf-panel" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
                <div className="wf-stack" style={{ gap: 6, fontSize: 11 }}>
                  {[
                    ['Должность', job.title],
                    ['Тип', job.employment_type],
                    ['З/п', job.salary],
                    ['Район', job.location],
                    ['Требования', job.requirements?.slice(0, 80)],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label} className="between" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--muted)' }}>{label}</span>
                        <span style={{ fontWeight: 500, textAlign: 'right' }}>{value}</span>
                      </div>
                    ))}
                </div>

                <div className="between" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--accent)' }}>
                  <span className="stat" style={{ color: 'var(--accent-ink)' }}>
                    {job.status === 'active' ? 'сохранено в БД' : job.status}
                  </span>
                  <span className="badge ok">готово</span>
                </div>
              </div>
            ) : (
              <div className="wf-empty">
                {selected ? 'Агент ещё не извлёк поля вакансии.' : 'Выберите компанию.'}
              </div>
            )}
          </div>

          <div className="wf-stack" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', gap: 10 }}>
            <div className="h-eyebrow">За сегодня</div>
            <div className="wf-stat-grid">
              <div>
                <div className="num">{businesses.length}</div>
                <div className="stat">Всего компаний</div>
              </div>
              <div>
                <div className="num">{stats.COMPLETED || 0}</div>
                <div className="stat">Сохранено</div>
              </div>
              <div>
                <div className="num">{stats.COLLECTING || 0}</div>
                <div className="stat">В работе</div>
              </div>
            </div>
          </div>

          <div className="no-scroll" style={{ padding: '12px 14px', overflow: 'auto', flex: 1 }}>
            <div className="h-eyebrow">Live log</div>
            <div className="wf-stack" style={{ gap: 3, marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {logs.slice(-50).map((log, index) => (
                <div key={`${log.ts}-${index}`} style={{ color: LOG_COLOR[log.type] || '#6b7280' }}>
                  <span style={{ color: 'var(--muted-2)', marginRight: 6 }}>{log.ts}</span>
                  {log.msg}
                </div>
              ))}

              {logs.length === 0 ? <div style={{ color: 'var(--muted)' }}>Ожидание событий…</div> : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
