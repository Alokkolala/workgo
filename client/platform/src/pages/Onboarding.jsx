import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import TopBar from '../components/TopBar.jsx'
import { createOrUpdateApplicant } from '../api.js'

const DISTRICTS = ['1 мкр', '3 мкр', '5 мкр', '7 мкр', '11 мкр', '14 мкр', '17 мкр', '27 мкр', 'Новый город']
const TYPES = [
  { value: 'full', label: 'Полная' },
  { value: 'part', label: 'Частичная' },
  { value: 'gig', label: 'Подработка' },
]
const STEPS = ['Контакты', 'Навыки', 'Район']

export default function Onboarding() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    skills: '',
    experience: '',
    employment_type: '',
    district: '',
    bio: '',
  })

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  async function finish() {
    setSaving(true)
    setError('')

    try {
      const applicant = await createOrUpdateApplicant(form)
      if (!applicant?.id) {
        setError(applicant?.error || 'Не удалось сохранить профиль')
        return
      }

      localStorage.setItem(
        'wg_applicant',
        JSON.stringify({ id: applicant.id, name: form.name, phone: form.phone })
      )
      navigate('/')
    } finally {
      setSaving(false)
    }
  }

  async function handleNext() {
    if (step === 0 && (!form.name.trim() || !form.phone.trim())) {
      setError('Имя и телефон обязательны')
      return
    }

    setError('')
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1)
      return
    }

    await finish()
  }

  return (
    <div className="page">
      <TopBar context="новый пользователь" />

      <div className="page-scroll center" style={{ alignItems: 'flex-start' }}>
        <div className="wf-shell" style={{ maxWidth: 540 }}>
          <div className="wf-stack-lg">
            <div className="step-bar">
              {STEPS.map((label, index) => (
                <div key={label} className={`step-bar-item ${index <= step ? 'done' : ''}`} />
              ))}
            </div>

            <div className="wf-stack" style={{ gap: 6 }}>
              <div className="h-eyebrow">Шаг {step + 1} из {STEPS.length}</div>
              <h1 className="wf-title">
                {step === 0 && <>Как к тебе <span className="underline-hand">обращаться</span>?</>}
                {step === 1 && <>Твои навыки и опыт</>}
                {step === 2 && <>Где тебе <span className="circle-hand">удобно</span> работать?</>}
              </h1>
              <p className="wf-subtitle">
                {step === 0 && 'Сделаем короткий профиль, чтобы работодатели могли быстро с тобой связаться.'}
                {step === 1 && 'AI использует эти данные, чтобы показывать подходящие вакансии ближе к дому.'}
                {step === 2 && 'Район влияет на ленту — сначала покажем вакансии рядом и удобные по маршруту.'}
              </p>
            </div>

            <div className="wf-panel wf-stack" style={{ gap: 18 }}>
              {step === 0 && (
                <>
                  <div>
                    <div className="wf-note" style={{ marginBottom: 6 }}>Имя *</div>
                    <div className="input">
                      <input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="Айдар" />
                    </div>
                  </div>

                  <div>
                    <div className="wf-note" style={{ marginBottom: 6 }}>Телефон *</div>
                    <div className="input">
                      <input
                        value={form.phone}
                        onChange={(event) => setField('phone', event.target.value)}
                        placeholder="87001234567"
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <div className="between" style={{ marginBottom: 8, alignItems: 'center' }}>
                      <span className="wf-note">Тип занятости</span>
                      <span className="badge ai">✦ AI учтёт это</span>
                    </div>
                    <div className="wf-toolbar">
                      {TYPES.map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          className={`chip ${form.employment_type === type.value ? 'on' : ''}`}
                          onClick={() => setField('employment_type', form.employment_type === type.value ? '' : type.value)}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="wf-note" style={{ marginBottom: 6 }}>Опыт работы</div>
                    <select className="select" style={{ width: '100%' }} value={form.experience} onChange={(event) => setField('experience', event.target.value)}>
                      <option value="">Выбери опыт</option>
                      <option value="0-1 лет">Без опыта / до 1 года</option>
                      <option value="1-3 лет">1–3 года</option>
                      <option value="3+ лет">3+ лет</option>
                    </select>
                  </div>

                  <div>
                    <div className="wf-note" style={{ marginBottom: 6 }}>Навыки</div>
                    <div className="input">
                      <input
                        value={form.skills}
                        onChange={(event) => setField('skills', event.target.value)}
                        placeholder="1С, касса, английский, водительские права..."
                      />
                    </div>
                  </div>

                  <div>
                    <div className="between" style={{ marginBottom: 6 }}>
                      <span className="wf-note">О себе</span>
                      <span className="wf-scribble">AI поможет структурировать</span>
                    </div>
                    <div className="input" style={{ height: 'auto', alignItems: 'flex-start' }}>
                      <textarea
                        rows={3}
                        value={form.bio}
                        onChange={(event) => setField('bio', event.target.value)}
                        placeholder="Опиши себя свободно — AI выделит важное"
                        style={{ minHeight: 72 }}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <div className="wf-note" style={{ marginBottom: 8 }}>Выбери свой район</div>
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

                  {form.district ? (
                    <div className="ai-strip">
                      В районе {form.district} уже есть активные вакансии — покажем их в первую очередь после регистрации.
                    </div>
                  ) : (
                    <div className="wf-empty">
                      Выбери район, чтобы AI сразу перестроил ленту под ближайшие вакансии.
                    </div>
                  )}
                </>
              )}

              {error ? <div className="wf-note" style={{ color: '#c0392b' }}>{error}</div> : null}

              <div className="row gap-10" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {step > 0 ? (
                  <button type="button" className="btn ghost" onClick={() => setStep((current) => current - 1)}>
                    Назад
                  </button>
                ) : null}

                <button type="button" className="btn" onClick={handleNext} disabled={saving}>
                  {step === STEPS.length - 1 ? (saving ? 'Сохраняю...' : 'Готово → Смотреть вакансии') : 'Далее →'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'center' }} className="wf-note">
              Уже есть профиль? <Link to="/profile" style={{ color: 'var(--ink)' }}>Перейти в профиль</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
