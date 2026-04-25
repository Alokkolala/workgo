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
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal wf-stack">
        {done ? (
          <>
            <div className="wf-panel" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', textAlign: 'center' }}>
              <div className="h-eyebrow" style={{ color: 'var(--accent-ink)' }}>✦ Отклик отправлен</div>
              <div className="h-title" style={{ fontSize: 16, marginTop: 6 }}>Работодатель получил ваш отклик</div>
              <div className="wf-note" style={{ marginTop: 8 }}>
                Дальше связь пойдёт по телефону, который вы указали.
              </div>
            </div>
            <button type="button" className="btn" onClick={onClose}>
              Закрыть
            </button>
          </>
        ) : (
          <>
            <div className="between">
              <div className="h-title" style={{ fontSize: 16 }}>Откликнуться</div>
              <button type="button" className="btn ghost sm" onClick={onClose}>✕</button>
            </div>

            <div className="wf-stack" style={{ gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Ваше имя *</div>
                <div className="input">
                  <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Айдар Сейткали" />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Номер телефона *</div>
                <div className="input">
                  <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" placeholder="87001234567" />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Сопроводительное сообщение</div>
                <div className="input" style={{ height: 'auto', alignItems: 'flex-start' }}>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    placeholder="Почему хотите здесь работать?"
                    style={{ minHeight: 72 }}
                  />
                </div>
              </div>
            </div>

            {error && <div className="wf-note" style={{ color: '#C0392B' }}>{error}</div>}

            <div className="row gap-8">
              <button type="button" className="btn flex-1" onClick={submit} disabled={loading}>
                {loading ? 'Отправляем...' : 'Отправить отклик'}
              </button>
              <button type="button" className="btn ghost" onClick={onClose}>
                Отмена
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
