import { useState } from 'react'
import { matchJobs } from '../api.js'

export default function MatchModal({ onClose, onMatches }) {
  const [skills, setSkills] = useState('')
  const [experience, setExperience] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [loading, setLoading] = useState(false)

  async function run() {
    if (!skills.trim()) return
    setLoading(true)
    try {
      const { matches } = await matchJobs({ skills, experience, employment_type: employmentType })
      if (!matches || matches.length === 0) {
        alert('Подходящих вакансий не найдено. Попробуйте изменить навыки.')
        return
      }
      onMatches(matches)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">✨ AI подбор вакансий</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Ваши навыки *</label>
            <input
              value={skills}
              onChange={e => setSkills(e.target.value)}
              placeholder="повар, кассир, водитель..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Опыт работы</label>
            <select
              value={experience}
              onChange={e => setExperience(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">Не важно</option>
              <option value="0-1 лет">Без опыта / до 1 года</option>
              <option value="1-3 лет">1–3 года</option>
              <option value="3+ лет">3+ лет</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Тип занятости</label>
            <select
              value={employmentType}
              onChange={e => setEmploymentType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">Любой</option>
              <option value="full">Полная занятость</option>
              <option value="part">Частичная</option>
              <option value="gig">Подработка</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
            Отмена
          </button>
          <button
            onClick={run}
            disabled={loading || !skills.trim()}
            className="flex-1 bg-purple-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Анализирую...' : 'Найти подходящие'}
          </button>
        </div>
      </div>
    </div>
  )
}
