import { Link } from 'react-router-dom'
import { extractDistrict } from './jobCard.helpers.js'

const TYPE_LABEL = { full: 'Полная', part: 'Частичная', gig: 'Подработка' }

export default function JobCard({ job, matchReason }) {
  const biz = job.businesses || {}
  const matchScore = Number(job._matchScore)
  const hasMatchScore = Number.isFinite(matchScore)
  const district = biz.address ? extractDistrict(biz.address) : ''

  return (
    <Link to={`/job/${job.id}`} className="wf-panel col gap-10" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div className="col gap-4" style={{ minWidth: 0 }}>
          <div className="h-eyebrow">
            {[biz.name, district].filter(Boolean).join(' · ')}
          </div>
          <div className="h-title" style={{ fontSize: 14, lineHeight: 1.35 }}>
            {job.title || 'Вакансия'}
          </div>
        </div>

        {hasMatchScore ? (
          <div className="col gap-4" style={{ minWidth: 76, alignItems: 'flex-end' }}>
            <span className="match">{matchScore}%</span>
            <div className="match-bar" style={{ width: 74, '--w': `${matchScore}%` }} />
          </div>
        ) : null}
      </div>

      <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
        {job.salary && (
          <span className="chip" style={{ fontSize: 9, padding: '3px 8px', cursor: 'default' }}>
            {job.salary}
          </span>
        )}
        {job.employment_type && (
          <span className="chip" style={{ fontSize: 9, padding: '3px 8px', cursor: 'default' }}>
            {TYPE_LABEL[job.employment_type] || job.employment_type}
          </span>
        )}
        {district && (
          <span className="chip" style={{ fontSize: 9, padding: '3px 8px', cursor: 'default' }}>
            {district}
          </span>
        )}
      </div>

      {matchReason && (
        <div className="wf-note" style={{ padding: '7px 9px', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 5, color: 'var(--accent-ink)' }}>
          {matchReason}
        </div>
      )}

      <div className="between" style={{ gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
        <span className="stat">Живая вакансия малого бизнеса</span>
        {hasMatchScore ? <span className="badge ai">подходит тебе</span> : null}
      </div>
    </Link>
  )
}
