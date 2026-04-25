import { useEffect, useMemo, useState } from 'react'

import CandidateCard from '../components/CandidateCard.jsx'
import TopBar from '../components/TopBar.jsx'
import {
  getApplicationsByBusiness,
  getBusinesses,
  getJobsByBusiness,
  matchCandidates,
  updateApplicationStatus,
} from '../api.js'

export default function Employer() {
  const [query, setQuery] = useState('')
  const [businesses, setBusinesses] = useState([])
  const [selectedBiz, setSelectedBiz] = useState(null)
  const [applications, setApplications] = useState([])
  const [jobs, setJobs] = useState([])
  const [matchResult, setMatchResult] = useState(null)
  const [matchLoading, setMatchLoading] = useState(null)

  useEffect(() => {
    getBusinesses().then((result) => setBusinesses(result.data || []))
  }, [])

  async function selectBusiness(business) {
    setSelectedBiz(business)
    setMatchResult(null)
    const [nextApplications, nextJobs] = await Promise.all([
      getApplicationsByBusiness(business.id),
      getJobsByBusiness(business.id),
    ])
    setApplications(nextApplications?.applications || nextApplications || [])
    setJobs(nextJobs || [])
  }

  async function changeStatus(applicationId, status) {
    await updateApplicationStatus(applicationId, status)
    if (selectedBiz) {
      const nextApplications = await getApplicationsByBusiness(selectedBiz.id)
      setApplications(nextApplications?.applications || nextApplications || [])
    }
  }

  async function handleMatchCandidates(job) {
    setMatchLoading(job.id)
    const result = await matchCandidates(job.id)
    setMatchLoading(false)
    setMatchResult({ jobTitle: job.title, matches: result.matches || [] })
  }

  const filteredBusinesses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return businesses
    }

    return businesses.filter((business) => {
      const name = (business.name || '').toLowerCase()
      const category = (business.category || '').toLowerCase()
      return name.includes(normalizedQuery) || category.includes(normalizedQuery)
    })
  }, [businesses, query])

  return (
    <div className="page">
      <TopBar context="работодатель" />

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: selectedBiz ? '300px 1fr' : '1fr',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <aside className="wf-sidebar">
          <div className="wf-stack" style={{ padding: 20, borderBottom: '1px solid var(--line)', gap: 12 }}>
            <div className="h-eyebrow">Компании</div>
            <h1 className="wf-title" style={{ fontSize: 22 }}>Работодатель</h1>
            <div className="input">
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Название или категория..."
              />
            </div>
          </div>

          <div className="no-scroll" style={{ overflow: 'auto', flex: 1 }}>
            {filteredBusinesses.length === 0 ? (
              <div className="center" style={{ height: 160, padding: 20 }}>
                <div className="wf-empty" style={{ width: '100%' }}>Компания не найдена</div>
              </div>
            ) : (
              filteredBusinesses.map((business) => (
                <button
                  key={business.id}
                  type="button"
                  className={`wf-list-row ${selectedBiz?.id === business.id ? 'wf-selected' : ''}`}
                  onClick={() => selectBusiness(business)}
                  style={{ gridTemplateColumns: '1fr' }}
                >
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{business.name}</div>
                  <div className="wf-note">{business.category}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        {selectedBiz ? (
          <div className="page-scroll">
            <main className="wf-shell wf-stack-lg" style={{ maxWidth: 'none', gap: 24 }}>
              <div className="wf-header">
                <div className="wf-stack" style={{ gap: 4 }}>
                  <div className="h-eyebrow">{selectedBiz.category}</div>
                  <h2 className="wf-title" style={{ fontSize: 22 }}>{selectedBiz.name}</h2>
                  <div className="wf-note">{selectedBiz.address}</div>
                </div>

                {selectedBiz.phone ? (
                  <a href={`tel:${selectedBiz.phone}`} className="btn ghost sm">
                    Позвонить
                  </a>
                ) : null}
              </div>

              {matchResult ? (
                <section className="wf-stack" style={{ gap: 12 }}>
                  <div className="between" style={{ gap: 12, flexWrap: 'wrap' }}>
                    <div className="ai-strip">AI подобрал кандидатов · {matchResult.jobTitle}</div>
                    <button type="button" className="btn ghost sm" onClick={() => setMatchResult(null)}>
                      ✕ Закрыть
                    </button>
                  </div>

                  {matchResult.matches.length === 0 ? (
                    <div className="wf-empty">Подходящих кандидатов не найдено</div>
                  ) : (
                    <div className="wf-grid-cards">
                      {matchResult.matches.map((match) => (
                        <CandidateCard key={match.applicant_id} candidate={match} />
                      ))}
                    </div>
                  )}
                </section>
              ) : null}

              {jobs.length > 0 ? (
                <section className="wf-stack" style={{ gap: 12 }}>
                  <div className="section-divider">Вакансии · {jobs.length}</div>

                  {jobs.map((job) => (
                    <div key={job.id} className="wf-panel between" style={{ gap: 12, flexWrap: 'wrap', padding: '12px 16px' }}>
                      <div className="wf-stack" style={{ gap: 6 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{job.title || 'Вакансия'}</div>
                        <div className="wf-toolbar">
                          {job.salary ? <span className="chip" style={{ fontSize: 9 }}>{job.salary}</span> : null}
                          {job.employment_type ? <span className="chip" style={{ fontSize: 9 }}>{job.employment_type}</span> : null}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn sm"
                        style={{ background: 'var(--accent-ink)', borderColor: 'var(--accent-ink)' }}
                        onClick={() => handleMatchCandidates(job)}
                        disabled={matchLoading === job.id}
                      >
                        {matchLoading === job.id ? '✦ Подбираю...' : '✦ AI кандидаты'}
                      </button>
                    </div>
                  ))}
                </section>
              ) : null}

              <section className="wf-stack" style={{ gap: 12 }}>
                <div className="section-divider">Отклики · {applications.length}</div>

                {applications.length === 0 ? (
                  <div className="wf-empty">У компании пока нет откликов</div>
                ) : (
                  <div className="wf-grid-cards">
                    {applications.map((application) => (
                      <CandidateCard key={application.id} candidate={application} onUpdateStatus={changeStatus} />
                    ))}
                  </div>
                )}
              </section>
            </main>
          </div>
        ) : (
          <div className="center flex-1">
            <div className="wf-empty" style={{ maxWidth: 340 }}>
              <div style={{ color: 'var(--ink)', marginBottom: 8 }}>Выберите компанию слева</div>
              <div className="wf-note">Можно искать по названию или категории.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
