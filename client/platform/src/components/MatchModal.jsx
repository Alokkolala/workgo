import { useState } from 'react'
import { matchJobs } from '../api.js'

export default function MatchModal({ onClose, onMatches }) {
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!skills.trim()) return
    setLoading(true)
    setError('')
    try {
      const { matches } = await matchJobs({ skills, experience, employment_type: employmentType })
      if (!matches || matches.length === 0) {
        setError('Подходящих вакансий не найдено. Попробуйте изменить навыки.')
        return
      }
      onMatches(matches)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal wf-stack">
        <div className="between">
          <div>
            <div className="h-eyebrow">✦ AI подбор</div>
            <div className="h-title" style={{ marginTop: 4, fontSize: 16 }}>Найти подходящие вакансии</div>
          </div>
          <button type="button" className="btn ghost sm" onClick={onClose}>✕</button>
        </div>

        <div className="wf-stack" style={{ gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Ваши навыки *</div>
            <div className="input">
              <input
                value={skills}
                onChange={(event) => setSkills(event.target.value)}
                placeholder="повар, кассир, водитель..."
              />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Опыт работы</div>
            <select className="select" value={experience} onChange={(event) => setExperience(event.target.value)}>
              <option value="">Не важно</option>
              <option value="0-1 лет">Без опыта / до 1 года</option>
              <option value="1-3 лет">1–3 года</option>
              <option value="3+ лет">3+ лет</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Тип занятости</div>
            <select className="select" value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}>
              <option value="">Любой</option>
              <option value="full">Полная занятость</option>
              <option value="part">Частичная</option>
              <option value="gig">Подработка</option>
            </select>
          </div>
        </div>

        {error && <div className="wf-note" style={{ color: '#C0392B' }}>{error}</div>}

        <div className="row gap-8">
          <button type="button" className="btn ghost" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            onClick={run}
            disabled={loading || !skills.trim()}
            className="btn flex-1"
            style={{ background: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
          >
            {loading ? 'Подбираю...' : '✦ Найти совпадения'}
          </button>
        </div>
      </div>
    </div>
  )
}
