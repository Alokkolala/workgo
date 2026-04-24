import { useState } from 'react'
import { createOrUpdateApplicant, applyToJob } from '../api.js'

export default function ApplyModal({ jobId, onClose }) {
  const saved = JSON.parse(localStorage.getItem('wg_applicant') || '{}')
  const [name, setName] = useState(saved.name || '')
  const [phone, setPhone] = useState(saved.phone || '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!name.trim() || !phone.trim()) { setError('Введите имя и телефон'); return }
    setError('')
    setLoading(true)
    try {
      const applicant = await createOrUpdateApplicant({ name: name.trim(), phone: phone.trim() })
      if (applicant.error) { setError(applicant.error); return }

      localStorage.setItem('wg_applicant', JSON.stringify({ id: applicant.id, name: applicant.name, phone: applicant.phone }))

      const { status, data } = await applyToJob({
        job_id: jobId,
        applicant_id: applicant.id,
        cover_message: message.trim() || null
      })

      if (status === 409) { setError('Вы уже откликались на эту вакансию'); return }
      if (status >= 400) { setError(data.error || 'Ошибка. Попробуйте позже'); return }

      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-bold mb-4">Отклик на вакансию</h2>

        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✅</div>
            <p className="font-semibold text-gray-800">Отклик отправлен!</p>
            <p className="text-sm text-gray-500 mt-1">Работодатель свяжется с вами по телефону</p>
            <button onClick={onClose} className="mt-4 text-blue-600 text-sm hover:underline">Закрыть</button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Ваше имя *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Айдар Сейткали"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Номер телефона *</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" placeholder="87001234567"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-sm text-gray-600 mb-1 block">Сопроводительное сообщение</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                  placeholder="Почему хотите здесь работать?"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                Отмена
              </button>
              <button onClick={submit} disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Отправляем...' : 'Отправить отклик'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
