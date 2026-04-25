export default function WAMessage({ message }) {
  const isAgent = message.role === 'agent'
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <div style={{ alignSelf: isAgent ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
      <div
        style={{
          background: isAgent ? '#DCF8C6' : '#FFFFFF',
          border: '1px solid #E1E1E1',
          borderRadius: 8,
          padding: '8px 10px 6px',
          fontSize: 12,
          lineHeight: 1.4,
          color: '#111111',
          boxShadow: '0 1px 0 rgba(0, 0, 0, 0.04)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.content}
        <div
          style={{
            fontSize: 9,
            color: '#7C7C7C',
            textAlign: 'right',
            marginTop: 4,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {time}
          {isAgent ? ' ✓✓' : ''}
        </div>
      </div>
    </div>
  )
}
