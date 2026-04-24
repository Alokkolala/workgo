import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getJob } from '../api.js'
import ApplyModal from '../components/ApplyModal.jsx'

const TYPE_LABEL = { full: 'Полная занятость', part: 'Частичная занятость', gig: 'Подработка' }
const TYPE_CLASS = {
  full: 'bg-green-100 text-green-800',
  part: 'bg-blue-100 text-blue-800',
  gig: 'bg-yellow-100 text-yellow-800'
}

export default function JobDetail() {
  const { id } = useParams()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showApply, setShowApply] = useState(false)

  useEffect(() => {
    getJob(id).then(data => { setJob(data.error ? null : data); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Загрузка...</div>
  )
  if (!job) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-400">
      <p className="text-lg">Вакансия не найдена</p>
      <Link to="/" className="text-blue-500 mt-2 hover:underline">← Все вакансии</Link>
    </div>
  )

  const biz = job.businesses || {}

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-gray-400 hover:text-gray-700 text-sm">← Все вакансии</Link>
          <span className="text-xl font-bold text-blue-600">WorkGo</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
              <p className="text-blue-600 font-medium mt-1">{biz.name}</p>
              {biz.address && <p className="text-sm text-gray-400 mt-0.5">📍 {biz.address}</p>}
            </div>
            <div className="text-right shrink-0">
              {job.salary && <p className="text-xl font-bold text-green-700">{job.salary}</p>}
              {job.employment_type && (
                <span className={`text-xs px-3 py-1 rounded-full font-medium mt-1 inline-block ${TYPE_CLASS[job.employment_type] || ''}`}>
                  {TYPE_LABEL[job.employment_type] || job.employment_type}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowApply(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-base hover:bg-blue-700 transition"
          >
            Откликнуться
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">О вакансии</h2>
          {job.description
            ? <p className="text-gray-600 text-sm leading-relaxed mb-4">{job.description}</p>
            : <p className="text-gray-400 text-sm mb-4">Описание не указано</p>
          }
          {job.requirements && (
            <>
              <h3 className="font-medium text-gray-800 mb-2 text-sm">Требования</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{job.requirements}</p>
            </>
          )}
        </div>
      </main>

      {showApply && <ApplyModal jobId={id} onClose={() => setShowApply(false)} />}
    </div>
  )
}
