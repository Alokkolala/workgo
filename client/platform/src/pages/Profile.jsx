import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import TopBar from '../components/TopBar.jsx'
import { createOrUpdateApplicant, getApplicantById, getApplicationsByApplicant, matchJobs } from '../api.js'

const STATUS_LABEL = { pending: 'На рассмотрении', viewed: 'Просмотрено', accepted: 'Принят', rejected: 'Отказ' }
const STATUS_KIND = { pending: 'warn', viewed: '', accepted: 'ok', rejected: '' }
const DISTRICTS = ['1 мкр', '3 мкр', '5 мкр', '7 мкр', '11 мкр', '14 мкр', '17 мкр', '27 мкр', 'Новый город']

export default function Profile() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', phone: '', skills: '', experience: '', employment_type: '', district: '', bio: '' })
  const [applications, setApplications] = useState([])
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wg_applicant') || '{}')
    if (saved.id) {
      getApplicantById(saved.id).then((applicant) => {
        if (!applicant.error) {
          setForm({
            name: applicant.name || '',
            phone: applicant.phone || '',
            skills: applicant.skills || '',
            experience: applicant.experience || '',
            employment_type: applicant.employment_type || '',
            district: applicant.district || '',
            bio: applicant.bio || '',
          })
        }
      })
      getApplicationsByApplicant(saved.id).then((result) => setApplications(result?.applications || result || []))
    }
  }, [])

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) {
      setMsg({ text: 'Имя и телефон обязательны', type: 'error' })
      return
    }

    setSaving(true)
    setMsg(null)
    const applicant = await createOrUpdateApplicant(form)
    if (applicant.error) {
      setMsg({ text: applicant.error, type: 'error' })
      setSaving(false)
      return
    }

    localStorage.setItem('wg_applicant', JSON.stringify({ id: applicant.id, name: applicant.name, phone: applicant.phone }))
    setMsg({ text: 'Профиль сохранён', type: 'ok' })
    getApplicationsByApplicant(applicant.id).then((result) => setApplications(result?.applications || result || []))
    setSaving(false)
  }

  async function findMatches() {
    if (!form.skills.trim()) {
      setMsg({ text: 'Заполни навыки для AI-подбора', type: 'error' })
      return
    }

    setMatching(true)
    setMsg(null)
    const { matches } = await matchJobs({
      skills: form.skills,
      experience: form.experience,
      employment_type: form.employment_type,
      district: form.district,
    })
    setMatching(false)
    if (!matches?.length) {
      setMsg({ text: 'Подходящих вакансий не найдено', type: 'error' })
      return
    }

    sessionStorage.setItem('wg_matches', JSON.stringify(matches))
    navigate('/')
  }

  return (
    <div className="page">
      <TopBar context="соискатель" />

      <div className="page-scroll">
        <main className="wf-shell" style={{ maxWidth: 760 }}>
          <div className="wf-stack-lg" style={{ gap: 28 }}>
            <div className="wf-header">
              <div className="wf-stack" style={{ gap: 6 }}>
                <div className="h-eyebrow">Соискатель</div>
                <h1 className="wf-title">Мой профиль</h1>
              </div>

              <button
                type="button"
                className="btn"
                style={{ background: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
                onClick={findMatches}
                disabled={matching}
              >
                {matching ? '✦ Подбираю...' : '✦ Найти вакансии'}
              </button>
            </div>

            <section className="wf-panel wf-stack-lg" style={{ gap: 18 }}>
              <div className="h-title">Контакты</div>

              <div className="wf-grid-2">
                <div>
                  <div className="wf-note" style={{ marginBottom: 6 }}>Имя *</div>
                  <div className="input">
                    <input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Имя" />
                  </div>
                </div>

                <div>
                  <div className="wf-note" style={{ marginBottom: 6 }}>Телефон *</div>
                  <div className="input">
                    <input value={form.phone} onChange={(event) => setField('phone', event.target.value)} placeholder="Телефон" />
                  </div>
                </div>
              </div>

              <div className="h-title">Навыки и опыт</div>

              <div>
                <div className="wf-note" style={{ marginBottom: 6 }}>Навыки</div>
                <div className="input">
                  <input value={form.skills} onChange={(event) => setField('skills', event.target.value)} placeholder="1С, касса, английский..." />
                </div>
              </div>

              <div className="wf-grid-2">
                <div>
                  <div className="wf-note" style={{ marginBottom: 6 }}>Опыт работы</div>
                  <select className="select" style={{ width: '100%' }} value={form.experience} onChange={(event) => setField('experience', event.target.value)}>
                    <option value="">Опыт работы</option>
                    <option value="0-1 лет">До 1 года</option>
                    <option value="1-3 лет">1–3 года</option>
                    <option value="3+ лет">3+ лет</option>
                  </select>
                </div>

                <div>
                  <div className="between" style={{ marginBottom: 6 }}>
                    <span className="wf-note">Тип занятости</span>
                    <span className="badge ai">✦ AI</span>
                  </div>
                  <select className="select" style={{ width: '100%' }} value={form.employment_type} onChange={(event) => setField('employment_type', event.target.value)}>
                    <option value="">Тип занятости</option>
                    <option value="full">Полная</option>
                    <option value="part">Частичная</option>
                    <option value="gig">Подработка</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="wf-note" style={{ marginBottom: 8 }}>Район</div>
                <div className="wf-toolbar">
                  {DISTRICTS.map((district) => (
                    <button
                      key={district}
                      type="button"
                      className={`chip ${form.district === district ? 'on' : ''}`}
                      onClick={() => setField('district', form.district === district ? '' : district)}
                    >
                      {district}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="between" style={{ marginBottom: 6 }}>
                  <span className="wf-note">О себе</span>
                  <span className="wf-scribble">кратко и по делу</span>
                </div>
                <div className="input" style={{ height: 'auto', alignItems: 'flex-start' }}>
                  <textarea value={form.bio} onChange={(event) => setField('bio', event.target.value)} rows={3} placeholder="О себе..." style={{ minHeight: 72 }} />
                </div>
              </div>

              {msg ? <div className="wf-note" style={{ color: msg.type === 'ok' ? '#2e5c2e' : '#c0392b' }}>{msg.text}</div> : null}

              <div className="wf-toolbar" style={{ justifyContent: 'space-between' }}>
                <div className="wf-note">AI использует район, тип занятости и навыки для ленты вакансий.</div>
                <button type="button" className="btn" onClick={save} disabled={saving}>
                  {saving ? 'Сохраняю...' : 'Сохранить профиль'}
                </button>
              </div>
            </section>

            <section className="wf-stack" style={{ gap: 12 }}>
              <div className="section-divider">Мои отклики · {applications.length}</div>

              {!applications.length ? (
                <div className="wf-empty">
                  Откликов пока нет. <Link to="/" style={{ color: 'var(--ink)' }}>Найти вакансии →</Link>
                </div>
              ) : (
                applications.map((application) => {
                  const job = application.jobs || {}
                  const biz = job.businesses || {}

                  return (
                    <div key={application.id} className="wf-panel between" style={{ gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
                      <div className="wf-stack" style={{ gap: 4 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{job.title || 'Вакансия'}</div>
                        <div className="wf-note">
                          {[biz.name, job.salary, new Date(application.created_at).toLocaleDateString('ru-RU')].filter(Boolean).join(' · ')}
                        </div>
                      </div>

                      <span className={`badge ${STATUS_KIND[application.status] || ''}`}>
                        {STATUS_LABEL[application.status] || application.status}
                      </span>
                    </div>
                  )
                })
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}
