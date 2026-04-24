import { useState, useEffect } from 'react'
import { getJobCategories } from '../api.js'

export default function FilterBar({ filters, onChange }) {
  const [categories, setCategories] = useState([])

  useEffect(() => {
    getJobCategories().then(({ categories }) => setCategories(categories || []))
  }, [])

  const set = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div className="bg-white border-b">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap gap-2 items-center">
        <select
          value={filters.employment_type || ''}
          onChange={e => set('employment_type', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Тип занятости</option>
          <option value="full">Полная</option>
          <option value="part">Частичная</option>
          <option value="gig">Подработка</option>
        </select>

        <select
          value={filters.category || ''}
          onChange={e => set('category', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Все сферы</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filters.district || ''}
          onChange={e => set('district', e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <option value="">Весь Актау</option>
          <option value="1-й мкр">1–6-й мкр</option>
          <option value="7-й мкр">7–12-й мкр</option>
          <option value="14-й мкр">14-й мкр</option>
          <option value="17-й мкр">17-й мкр</option>
          <option value="27-й мкр">27-й мкр</option>
          <option value="Новый город">Новый город</option>
        </select>

        {(filters.employment_type || filters.category || filters.district) && (
          <button
            onClick={() => onChange({ search: filters.search })}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            × Сбросить
          </button>
        )}
      </div>
    </div>
  )
}
