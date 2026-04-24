import { Link } from 'react-router-dom'

const TYPE_LABEL = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }
const TYPE_CLASS = {
  full: 'bg-green-100 text-green-800',
  part: 'bg-blue-100 text-blue-800',
  gig: 'bg-yellow-100 text-yellow-800'
}

export default function JobCard({ job, matchReason }) {
  const biz = job.businesses || {}
  return (
    <Link
      to={`/job/${job.id}`}
      className="block bg-white rounded-xl p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border border-transparent hover:border-blue-100"
    >
      {matchReason && (
        <p className="text-xs text-purple-600 bg-purple-50 rounded-lg px-2 py-1 mb-3">
          ✨ {matchReason}
        </p>
      )}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{job.title || 'Вакансия'}</h3>
          <p className="text-sm text-gray-500 truncate">{biz.name}</p>
        </div>
        {job.salary && (
          <span className="text-sm font-bold text-green-700 whitespace-nowrap">{job.salary}</span>
        )}
      </div>
      {job.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{job.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {job.employment_type && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_CLASS[job.employment_type] || 'bg-gray-100 text-gray-600'}`}>
            {TYPE_LABEL[job.employment_type] || job.employment_type}
          </span>
        )}
        {biz.address && (
          <span className="text-xs text-gray-400 truncate">📍 {biz.address.slice(0, 35)}</span>
        )}
      </div>
    </Link>
  )
}
