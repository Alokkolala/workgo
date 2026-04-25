export const DISTRICTS = [
  { value: '1-й мкр', label: '1–6 мкр' },
  { value: '7-й мкр', label: '7–12 мкр' },
  { value: '14-й мкр', label: '14 мкр' },
  { value: '17-й мкр', label: '17 мкр' },
  { value: '27-й мкр', label: '27 мкр' },
  { value: 'Новый город', label: 'Новый город' },
]

export const TYPES = [
  { value: 'gig', label: 'Подработка' },
  { value: 'part', label: 'Частичная' },
  { value: 'full', label: 'Полная' },
]

export function toggleFilter(filters, key, value) {
  return { ...filters, [key]: filters[key] === value ? '' : value }
}
