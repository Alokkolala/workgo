import { getBusinessInitials } from '../pages/admin.helpers.js'

const STATUS_DOT = {
  DISCOVERED: '#9A9A9F',
  CONTACTED: '#F1B947',
  INTERESTED: '#9B59B6',
  COLLECTING: '#F39C12',
  COMPLETED: '#25D366',
  REJECTED: '#E74C3C',
}

export default function BusinessRow({ business, selected, onClick }) {
  const time = business.updated_at
    ? new Date(business.updated_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <button
      type="button"
      onClick={onClick}
      className={`wf-list-row ${selected ? 'wf-selected' : ''}`}
      style={{ gridTemplateColumns: '36px 1fr auto', alignItems: 'center' }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'var(--line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--muted)',
          flexShrink: 0,
        }}
      >
        {getBusinessInitials(business.name)}
      </div>

      <div className="col gap-4" style={{ minWidth: 0 }}>
        <div className="between" style={{ gap: 8 }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {business.name}
          </div>
        </div>

        <div className="row gap-6" style={{ alignItems: 'center' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: STATUS_DOT[business.status] || '#9A9A9F',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10,
              color: 'var(--muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {[business.status, business.category].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{time}</span>
    </button>
  )
}
