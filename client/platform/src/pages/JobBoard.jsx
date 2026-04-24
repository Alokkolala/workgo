import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getJobs } from '../api.js'
import JobCard from '../components/JobCard.jsx'
import FilterBar from '../components/FilterBar.jsx'
import MatchModal from '../components/MatchModal.jsx'

export default function JobBoard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [showMatch, setShowMatch] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState(null)

  useEffect(() => {
    loadJobs()
  }, [filters])

  async function loadJobs() {
    setLoading(true)
    setMatchedJobs(null)
    const params = { ...filters }
    if (search.trim()) params.search = search.trim()
    const { jobs } = await getJobs(params)
    setJobs(jobs || [])
    setLoading(false)
  }

  function handleSearch(e) {
    if (e.key === 'Enter') loadJobs()
  }

  function handleMatches(matches) {
    setMatchedJobs(matches)
    setJobs(matches.map(m => m.job))
  }

  const displayJobs = matchedJobs
    ? matchedJobs.map(m => ({ ...m.job, _matchReason: m.reason }))
    : jobs

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xl font-bold text-blue-600">WorkGo</span>
            <span className="text-gray-400 text-sm ml-2 hidden sm:inline">Работа в Актау</span>
          </div>
          <div className="flex gap-3 text-sm">
            <Link to="/profile" className="text-blue-600 hover:underline">Мой профиль</Link>
            <Link to="/employer" className="text-gray-500 hover:underline">Работодателям</Link>
          </div>
        </div>
      </header>

      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold mb-1">Найди работу рядом с домом</h1>
          <p className="text-blue-200 mb-6">Реальные вакансии малого бизнеса Мангистауской области</p>
          <div className="flex gap-2 max-w-2xl">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Профессия, должность..."
              className="flex-1 px-4 py-3 rounded-xl text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={loadJobs}
              className="bg-white text-blue-700 font-semibold px-6 py-3 rounded-xl hover:bg-blue-50 transition text-sm"
            >
              Найти
            </button>
          </div>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />

      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-400">
          {loading ? 'Загрузка...' : matchedJobs ? `${displayJobs.length} AI-подобранных` : `${displayJobs.length} вакансий`}
        </span>
        <div className="flex gap-2">
          {matchedJobs && (
            <button onClick={loadJobs} className="text-sm text-blue-500 hover:underline">
              ← Все вакансии
            </button>
          )}
          <button
            onClick={() => setShowMatch(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
          >
            ✨ AI подбор
          </button>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 pb-10">
        {loading && <div className="text-center py-16 text-gray-400">Загружаем вакансии...</div>}
        {!loading && displayJobs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Вакансий не найдено</p>
            <p className="text-sm mt-1">Попробуйте изменить фильтры</p>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {displayJobs.map(job => (
            <JobCard key={job.id} job={job} matchReason={job._matchReason} />
          ))}
        </div>
      </main>

      {showMatch && <MatchModal onClose={() => setShowMatch(false)} onMatches={handleMatches} />}
    </div>
  )
}
