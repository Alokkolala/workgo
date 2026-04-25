import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getBusinesses, getApplicationsByBusiness, updateApplicationStatus, getJobsByBusiness, matchCandidates } from '../api.js'

const STATUS_LABEL = { pending: 'Новый', viewed: 'Просмотрено', accepted: 'Принят', rejected: 'Отказ' }
const STATUS_CLASS = {
  pending: 'bg-yellow-100 text-yellow-700',
  viewed: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500'
}

export default function Employer() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedBiz, setSelectedBiz] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(false)
  const [jobs, setJobs] = useState([])
  const [matchResult, setMatchResult] = useState(null) // { jobTitle, matches }
  const [matchLoading, setMatchLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    const { data } = await getBusinesses()
    const matches = (data || []).filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
    setResults(matches.slice(0, 6))
  }

  async function selectBusiness(biz) {
    setSelectedBiz(biz)
    setResults([])
    setQuery(biz.name)
    setLoading(true)
    const [apps, jobList] = await Promise.all([
      getApplicationsByBusiness(biz.id),
      getJobsByBusiness(biz.id),
    ])
    setApplications(Array.isArray(apps) ? apps : [])
    setJobs(Array.isArray(jobList) ? jobList : [])
    setMatchResult(null)
    setLoading(false)
  }

  async function changeStatus(appId, status) {
    await updateApplicationStatus(appId, status)
    if (selectedBiz) {
      const apps = await getApplicationsByBusiness(selectedBiz.id)
      setApplications(Array.isArray(apps) ? apps : [])
    }
  }

  async function handleMatchCandidates(job) {
    setMatchLoading(job.id)
    const result = await matchCandidates(job.id)
    setMatchLoading(false)
    setMatchResult({ jobTitle: job.title, matches: result.matches || [] })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-gray-400 hover:text-gray-700 text-sm">← Вакансии</Link>
          <span className="text-xl font-bold text-blue-600">WorkGo</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Для работодателей</h1>
        <p className="text-gray-500 text-sm mb-6">Найдите свой бизнес и просмотрите отклики</p>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <label className="text-sm text-gray-600 mb-2 block">Название вашего бизнеса</label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="Кафе, СТО, магазин..."
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button onClick={search} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
              Найти
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map(b => (
                <button key={b.id} onClick={() => selectBusiness(b)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-blue-50 text-sm border hover:border-blue-200 transition">
                  <span className="font-medium">{b.name}</span>
                  {b.category && <span className="text-gray-400 ml-2">{b.category}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedBiz && (
          <>
            {/* Jobs with AI match */}
            {jobs.length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-bold mb-3">Вакансии — {selectedBiz.name}</h2>
                {jobs.map(job => (
                  <div key={job.id} className="bg-white rounded-xl p-4 shadow-sm mb-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-800">{job.title || 'Вакансия'}</p>
                      {job.salary && <p className="text-sm text-gray-500">{job.salary}</p>}
                    </div>
                    <button
                      onClick={() => handleMatchCandidates(job)}
                      disabled={matchLoading === job.id}
                      className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {matchLoading === job.id ? 'AI анализирует...' : '✨ AI подбор'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* AI match results panel */}
            {matchResult && (
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-purple-800">AI: лучшие кандидаты на «{matchResult.jobTitle}»</h3>
                  <button onClick={() => setMatchResult(null)} className="text-purple-400 hover:text-purple-600 text-sm">✕</button>
                </div>
                {matchResult.matches.length === 0 && (
                  <p className="text-sm text-purple-600">Подходящих кандидатов не найдено. Добавьте больше соискателей.</p>
                )}
                {matchResult.matches.map(m => {
                  const ap = m.applicant || {}
                  return (
                    <div key={m.applicant_id} className="bg-white rounded-xl p-4 mb-2 shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{ap.name || 'Соискатель'}</span>
                            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                              {m.score}/10
                            </span>
                          </div>
                          {ap.skills && <p className="text-sm text-gray-600">Навыки: {ap.skills}</p>}
                          {ap.experience && <p className="text-xs text-gray-400">Опыт: {ap.experience}</p>}
                          <p className="text-xs text-purple-600 mt-1 italic">{m.reason}</p>
                        </div>
                        {ap.phone && (
                          <a href={`tel:${ap.phone}`} className="text-blue-600 text-sm font-semibold hover:underline shrink-0">
                            {ap.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Applications */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Отклики — {selectedBiz.name}</h2>
              <span className="text-sm text-gray-400">{applications.length} откликов</span>
            </div>
            {loading && <p className="text-gray-400 text-sm">Загрузка...</p>}
            {!loading && applications.length === 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm text-center text-gray-400 text-sm">Откликов пока нет</div>
            )}
            {applications.map(app => {
              const ap = app.applicants || {}
              const job = app.jobs || {}
              return (
                <div key={app.id} className="bg-white rounded-xl p-5 shadow-sm mb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{ap.name || 'Соискатель'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLASS[app.status] || ''}`}>
                          {STATUS_LABEL[app.status] || app.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">На вакансию: <span className="font-medium">{job.title}</span></p>
                      {ap.skills && <p className="text-sm text-gray-600 mt-1">Навыки: {ap.skills}</p>}
                      {ap.experience && <p className="text-xs text-gray-400">Опыт: {ap.experience}</p>}
                      {ap.district && <p className="text-xs text-gray-400">Район: {ap.district}</p>}
                      {app.cover_message && <p className="text-sm text-gray-500 mt-2 italic">"{app.cover_message}"</p>}
                    </div>
                    <div className="text-right shrink-0">
                      {ap.phone && (
                        <a href={`tel:${ap.phone}`} className="text-blue-600 font-semibold text-sm hover:underline block">{ap.phone}</a>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => changeStatus(app.id, 'accepted')}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-green-500 text-green-600 hover:bg-green-50 transition">
                      ✓ Принять
                    </button>
                    <button onClick={() => changeStatus(app.id, 'viewed')}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 transition">
                      Просмотрено
                    </button>
                    <button onClick={() => changeStatus(app.id, 'rejected')}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-red-300 text-red-500 hover:bg-red-50 transition">
                      ✗ Отказ
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </main>
    </div>
  )
}
