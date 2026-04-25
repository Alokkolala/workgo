export const STATUS_LABEL = {
  DISCOVERED: 'Не связались',
  CONTACTED: 'Написали',
  INTERESTED: 'Интерес',
  COLLECTING: 'Собираем',
  COMPLETED: 'Готово',
  REJECTED: 'Отказ',
}

export function filterBusinesses(businesses, query) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return businesses
  }

  return businesses.filter((business) => {
    const name = (business.name || '').toLowerCase()
    const category = (business.category || '').toLowerCase()
    return name.includes(normalizedQuery) || category.includes(normalizedQuery)
  })
}

export function getBusinessInitials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
