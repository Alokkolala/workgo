import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import ApplyModal from '../components/ApplyModal.jsx'
import TopBar from '../components/TopBar.jsx'
import { getJob } from '../api.js'

const TYPE_LABEL = { full: 'Полная занятость', part: 'Частичная', gig: 'Подработка' }

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)

  useEffect(() => {
    getJob(id).then((data) => {
      setJob(data?.error ? null : data)
      setLoading(false)
    })
  }, [id])

  const matches = JSON.parse(sessionStorage.getItem('wg_matches') || '[]')
  const myMatch = matches.find((match) => match.job_id === id || match.job?.id === id)
  const biz = job?.businesses || {}

  if (loading) {
    return (
      <div className="page">
        <TopBar context="соискатель" />
        <div className="center flex-1">
          <span className="stat">Загрузка...</span>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="page">
        <TopBar context="соискатель" />
        <div className="center flex-1">
          <div className="wf-empty" style={{ maxWidth: 420 }}>
            <div style={{ color: 'var(--ink)', marginBottom: 8 }}>Вакансия не найдена</div>
            <Link to="/" style={{ color: 'var(--ink)' }}>← Все вакансии</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <TopBar context="соискатель" />

      <div className="page-scroll" style={{ paddingBottom: 120 }}>
        <main className="wf-shell" style={{ maxWidth: 760 }}>
          <div className="wf-stack-lg">
            <Link to="/" className="wf-note" style={{ textDecoration: 'none' }}>
              ← Назад к вакансиям
            </Link>

            <section className="wf-stack" style={{ gap: 12 }}>
              <div className="h-eyebrow">{[biz.name, biz.address].filter(Boolean).join(' · ')}</div>
              <h1 className="wf-title" style={{ fontSize: 30 }}>{job.title}</h1>
              <div className="wf-toolbar">
                {job.salary ? <span className="chip">{job.salary}</span> : null}
                {job.employment_type ? <span className="chip">{TYPE_LABEL[job.employment_type] || job.employment_type}</span> : null}
                {job.location ? <span className="chip">📍 {job.location}</span> : null}
                {myMatch?.score != null ? <span className="chip ai">✦ {myMatch.score}% совпадение</span> : null}
              </div>
            </section>

            {myMatch?.reason ? (
              <section className="wf-panel wf-stack" style={{ gap: 8, background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
                <div className="h-eyebrow" style={{ color: 'var(--accent-ink)' }}>✦ Почему тебе подходит</div>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--accent-ink)' }}>{myMatch.reason}</p>
              </section>
            ) : null}

            <section className="wf-panel wf-stack-lg" style={{ gap: 20 }}>
              {job.description ? (
                <div className="wf-stack" style={{ gap: 10 }}>
                  <div className="h-title">Описание</div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                    {job.description}
                  </p>
                </div>
              ) : null}

              {job.requirements ? (
                <div className="wf-stack" style={{ gap: 10 }}>
                  <div className="h-title">Требования</div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
                    {job.requirements}
                  </p>
                </div>
              ) : null}

              {!job.description && !job.requirements ? (
                <div className="wf-empty">Подробное описание вакансии пока не указано.</div>
              ) : null}
            </section>

            <section className="wf-panel wf-stack" style={{ gap: 8 }}>
              <div className="h-eyebrow">О компании</div>
              <div className="between" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="wf-stack" style={{ gap: 4 }}>
                  <div className="h-title">{biz.name || 'Работодатель'}</div>
                  <div className="wf-note">{[biz.category, biz.address].filter(Boolean).join(' · ')}</div>
                </div>

                {biz.phone ? (
                  <a href={`tel:${biz.phone}`} className="btn ghost sm">
                    Позвонить
                  </a>
                ) : null}
              </div>
            </section>
          </div>
        </main>
      </div>

      <div className="wf-sticky-footer">
        <div className="wf-stack" style={{ gap: 2 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{job.title}</div>
          <div className="wf-note">{biz.name}</div>
        </div>

        <span className="flex-1" />

        {job.salary ? <span style={{ fontWeight: 600, fontSize: 14 }}>{job.salary}</span> : null}

        <button type="button" className="btn" onClick={() => setShowApply(true)}>
          Откликнуться
        </button>
      </div>

      {showApply ? <ApplyModal jobId={id} onClose={() => setShowApply(false)} /> : null}
    </div>
  )
}
