import { useEffect, useState } from 'react'
import { getJobs } from '../api.js'
import FilterBar from '../components/FilterBar.jsx'
import JobCard from '../components/JobCard.jsx'
import MatchModal from '../components/MatchModal.jsx'
import TopBar from '../components/TopBar.jsx'
import { buildDisplayJobs } from './jobBoard.helpers.js'

export default function JobBoard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [showMatch, setShowMatch] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState(null)
  const [restoredMatches, setRestoredMatches] = useState(false)

  useEffect(() => {
    const savedMatches = sessionStorage.getItem('wg_matches')
    if (savedMatches) {
      setMatchedJobs(JSON.parse(savedMatches))
    }
    setRestoredMatches(true)
  }, [])

  useEffect(() => {
    if (!restoredMatches || matchedJobs) {
      return
    }
    loadJobs()
  }, [filters, restoredMatches, matchedJobs])

  async function loadJobs(nextSearch = search) {
    setLoading(true)
    setMatchedJobs(null)
    sessionStorage.removeItem('wg_matches')
    const params = { ...filters }
    if (nextSearch.trim()) params.search = nextSearch.trim()
    const { jobs: resultJobs } = await getJobs(params)
    setJobs(resultJobs || [])
    setLoading(false)
  }

  function handleSearch(event) {
    if (event.key === 'Enter') loadJobs()
  }

  function handleMatches(matches) {
    setMatchedJobs(matches)
    sessionStorage.setItem('wg_matches', JSON.stringify(matches))
  }

  const displayJobs = buildDisplayJobs(jobs, matchedJobs)

  return (
    <div className="page">
      <TopBar context="соискатель" />

      <div className="page-scroll">
        <main className="wf-shell wf-stack-lg">
          <section className="wf-stack" style={{ gap: 18 }}>
            <div className="wf-header">
              <div className="wf-stack" style={{ gap: 6, flex: '1 1 280px' }}>
                <div className="h-eyebrow">Лента вакансий · Актау</div>
                <h1 className="wf-title">
                  Работа <span className="underline-hand">рядом с домом</span>
                </h1>
                <p className="wf-subtitle">
                  Реальные вакансии малого бизнеса Мангистауской области с AI-подсказками по навыкам и району.
                </p>
              </div>

              <div className="wf-toolbar" style={{ flex: '1 1 360px', justifyContent: 'flex-end' }}>
                <div className="input" style={{ minWidth: 260, flex: '1 1 260px' }}>
                  <span style={{ color: 'var(--muted-2)', fontSize: 13 }}>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={handleSearch}
                    placeholder="Должность, компания..."
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('')
                        loadJobs('')
                      }}
                      style={{ border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0 }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <button type="button" className="btn" onClick={loadJobs}>
                  Найти
                </button>
                <button
                  type="button"
                  onClick={() => setShowMatch(true)}
                  className="chip ai"
                  style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600 }}
                >
                  ✦ AI подбор
                </button>
              </div>
            </div>

            <div className="wf-panel wf-stack" style={{ gap: 12, background: 'var(--paper)' }}>
              <FilterBar
                filters={filters}
                onChange={(nextFilters) => {
                  setFilters(nextFilters)
                  if (matchedJobs) {
                    setMatchedJobs(null)
                    sessionStorage.removeItem('wg_matches')
                  }
                }}
              />
            </div>
          </section>

          <section className="wf-stack" style={{ gap: 14 }}>
            {matchedJobs ? (
              <div className="ai-strip">
                {`AI подобрал ${displayJobs.length} вакансий под твой профиль`}
                <button
                  type="button"
                  onClick={loadJobs}
                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent-ink)', textDecoration: 'underline', fontFamily: 'var(--font-mono)', fontSize: 11 }}
                >
                  показать все →
                </button>
              </div>
            ) : null}

            <div className="section-divider">
              {matchedJobs ? 'Топ совпадений' : 'Свежие вакансии'}
            </div>

            {loading ? (
              <div className="wf-empty" style={{ padding: '54px 18px' }}>
                Загружаем вакансии...
              </div>
            ) : null}

            {!loading && displayJobs.length === 0 ? (
              <div className="wf-empty" style={{ padding: '64px 20px' }}>
                <div style={{ fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>Вакансий не найдено</div>
                <div className="wf-note">Попробуйте изменить фильтры или запустить AI-подбор.</div>
              </div>
            ) : null}

            {!loading && displayJobs.length > 0 ? (
              <>
                <div className="stat">
                  {matchedJobs ? `${displayJobs.length} AI-подобранных` : `${displayJobs.length} вакансий`}
                </div>
                <div className="wf-grid-cards">
                  {displayJobs.map((job) => (
                    <JobCard key={job.id} job={job} matchReason={job._matchReason} />
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </main>
      </div>

      {showMatch ? <MatchModal onClose={() => setShowMatch(false)} onMatches={handleMatches} /> : null}
    </div>
  )
}
