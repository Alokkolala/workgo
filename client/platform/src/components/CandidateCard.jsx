export default function CandidateCard({ candidate, onUpdateStatus }) {
  const applicant = candidate.applicant || candidate.applicants || {}
  const score = candidate.score
  const reason = candidate.reason
  const status = candidate.status
  const applicationId = candidate.id
  const skills = (applicant.skills || '')
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 4)

  return (
    <div className="wf-panel col gap-10">
      <div className="between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="row gap-10" style={{ alignItems: 'center', minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--paper-2)',
              border: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--muted)',
              flexShrink: 0,
            }}
          >
            {applicant.name?.[0] || '?'}
          </div>

          <div className="col gap-4" style={{ minWidth: 0 }}>
            <div className="h-title" style={{ fontSize: 12 }}>
              {applicant.name || 'Соискатель'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[applicant.district, applicant.experience].filter(Boolean).join(' · ') || 'Профиль без деталей'}
            </div>
          </div>
        </div>

        {score != null && (
          <div style={{ minWidth: 72, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
            <span className="match">{score}%</span>
            <div className="match-bar" style={{ width: 72, '--w': `${score}%` }} />
          </div>
        )}
      </div>

      {reason && (
        <div style={{ fontSize: 10, color: 'var(--accent-ink)', fontFamily: 'var(--font-mono)', background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 4, padding: '5px 8px', lineHeight: 1.5 }}>
          {reason}
        </div>
      )}

      {skills.length > 0 && (
        <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
          {skills.map((skill) => (
            <span key={skill} className="chip" style={{ fontSize: 9 }}>
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className="between" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {status ? (
          <span className={`badge ${status === 'accepted' ? 'ok' : status === 'pending' ? 'warn' : ''}`}>
            {status}
          </span>
        ) : (
          <span className="stat">профиль кандидата</span>
        )}

        <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
          {applicant.phone && (
            <a href={`tel:${applicant.phone}`} className="btn ghost sm">
              Позвонить
            </a>
          )}
          {applicationId && onUpdateStatus && status !== 'accepted' && (
            <button type="button" className="btn sm" onClick={() => onUpdateStatus(applicationId, 'accepted')}>
              Принять
            </button>
          )}
          {applicationId && onUpdateStatus && status !== 'rejected' && (
            <button type="button" className="btn ghost sm" onClick={() => onUpdateStatus(applicationId, 'rejected')}>
              Отказать
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
