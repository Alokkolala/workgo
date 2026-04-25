import { DISTRICTS, TYPES, toggleFilter } from './filterBar.helpers.js'

export default function FilterBar({ filters, onChange }) {
  const hasActive = Boolean(filters.employment_type || filters.district)

  const setFilter = (key, value) => {
    onChange(toggleFilter(filters, key, value))
  }

  return (
    <div className="wf-stack" style={{ gap: 10 }}>
      <div className="wf-toolbar">
        <span className="h-eyebrow" style={{ marginRight: 4 }}>Район</span>
          {DISTRICTS.map((district) => (
            <button
              key={district.value}
              type="button"
              className={`chip${filters.district === district.value ? ' on' : ''}`}
              onClick={() => setFilter('district', district.value)}
            >
              {district.label}
            </button>
          ))}
      </div>

      <div className="wf-toolbar">
        <span className="h-eyebrow" style={{ marginRight: 4 }}>Тип</span>
          {TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              className={`chip${filters.employment_type === type.value ? ' on' : ''}`}
              onClick={() => setFilter('employment_type', type.value)}
            >
              {type.label}
            </button>
          ))}
          {hasActive && (
            <button
              type="button"
              className="chip"
              onClick={() => onChange({ ...filters, employment_type: '', district: '' })}
              style={{ color: 'var(--muted)', borderStyle: 'dashed' }}
            >
              × Сбросить
            </button>
          )}
      </div>
    </div>
  )
}
