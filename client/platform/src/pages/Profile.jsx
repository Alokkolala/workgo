import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { createOrUpdateApplicant, getApplicantById, getApplicationsByApplicant, matchJobs } from '../api.js'

const STATUS_LABEL = { pending: 'Ожидает', viewed: 'Просмотрено', accepted: 'Принят', rejected: 'Отказ' }
const STATUS_COLOR = { pending: 'text-yellow-600', viewed: 'text-blue-600', accepted: 'text-green-600', rejected: 'text-gray-400' }

export default function Profile() {
  const [form, setForm] = useState({ name: '', phone: '', skills: '', experience: '', employment_type: '', district: '', bio: '' })
  const [applications, setApplications] = useState([])
  const [msg, setMsg] = useState({ text: '', type: '' })
  const [saving, setSaving] = useState(false)
  const [matching, setMatching] = useState(false)

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('wg_applicant') || '{}')
    if (saved.id) {
      getApplicantById(saved.id).then(p => {
        if (!p.error) setForm({ name: p.name || '', phone: p.phone || '', skills: p.skills || '', experience: p.experience || '', employment_type: p.employment_type || '', district: p.district || '', bio: p.bio || '' })
      })
      getApplicationsByApplicant(saved.id).then(setApplications)
    }
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) { setMsg({ text: 'Введите имя и телефон', type: 'error' }); return }
    setSaving(true)
    const applicant = await createOrUpdateApplicant(form)
    setSaving(false)
    if (applicant.error) { setMsg({ text: applicant.error, type: 'error' }); return }
    localStorage.setItem('wg_applicant', JSON.stringify({ id: applicant.id, name: applicant.name, phone: applicant.phone }))
    setMsg({ text: '✅ Профиль сохранён', type: 'success' })
    getApplicationsByApplicant(applicant.id).then(setApplications)
  }

  async function findMatches() {
    if (!form.skills.trim()) { alert('Укажите навыки для AI-подбора'); return }
    setMatching(true)
    const { matches } = await matchJobs({ skills: form.skills, experience: form.experience, employment_type: form.employment_type, district: form.district })
    setMatching(false)
    if (!matches?.length) { alert('Подходящих вакансий не найдено'); return }
    sessionStorage.setItem('wg_matches', JSON.stringify(matches))
    window.location.href = '/platform/'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-gray-400 hover:text-gray-700 text-sm">← Вакансии</Link>
          <span className="text-xl font-bold text-blue-600">WorkGo</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Мой профиль</h1>

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Имя *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Айдар"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Телефон *</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="87001234567"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Навыки</label>
            <input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="повар, водитель, продавец..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Опыт</label>
              <select value={form.experience} onChange={e => set('experience', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Не указано</option>
                <option value="0-1 лет">До 1 года</option>
                <option value="1-3 лет">1–3 года</option>
                <option value="3+ лет">3+ лет</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Тип занятости</label>
              <select value={form.employment_type} onChange={e => set('employment_type', e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="">Не важно</option>
                <option value="full">Полная</option>
                <option value="part">Частичная</option>
                <option value="gig">Подработка</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Район Актау</label>
            <select value={form.district} onChange={e => set('district', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Не важно</option>
              <option value="1-й мкр">1–6-й мкр</option>
              <option value="7-й мкр">7–12-й мкр</option>
              <option value="14-й мкр">14-й мкр</option>
              <option value="17-й мкр">17-й мкр</option>
              <option value="27-й мкр">27-й мкр</option>
              <option value="Новый город">Новый город</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">О себе</label>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>
          {msg.text && <p className={`text-sm ${msg.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>{msg.text}</p>}
          <button onClick={save} disabled={saving}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
            {saving ? 'Сохраняем...' : 'Сохранить профиль'}
          </button>
          <button onClick={findMatches} disabled={matching}
            className="w-full border border-purple-500 text-purple-600 py-2 rounded-xl text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition">
            {matching ? 'AI анализирует...' : '✨ Найти подходящие вакансии'}
          </button>
        </div>

        <h2 className="text-lg font-bold mb-3">Мои отклики</h2>
        {!applications.length
          ? <p className="text-gray-400 text-sm bg-white rounded-xl p-4 shadow-sm">
              Откликов нет. <Link to="/" className="text-blue-500 hover:underline">Найти вакансии →</Link>
            </p>
          : applications.map(app => {
              const job = app.jobs || {}
              const biz = job.businesses || {}
              return (
                <div key={app.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{job.title || 'Вакансия'}</p>
                    <p className="text-sm text-gray-500">{biz.name} {job.salary ? `• ${job.salary}` : ''}</p>
                    <p className="text-xs text-gray-400">{new Date(app.created_at).toLocaleDateString('ru-RU')}</p>
                  </div>
                  <span className={`text-sm font-medium ${STATUS_COLOR[app.status] || ''}`}>
                    {STATUS_LABEL[app.status] || app.status}
                  </span>
                </div>
              )
            })
        }
      </main>
    </div>
  )
}
