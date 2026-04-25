export function extractDistrict(address) {
  if (!address) return ''

  const districtMatch = address.match(/(\d+)[- ]?(?:й)?\s*(?:мкр|микрорайон)/i)
  if (districtMatch) {
    return `${districtMatch[1]} мкр`
  }

  if (address.toLowerCase().includes('новый город')) {
    return 'Новый город'
  }

  return address.slice(0, 25)
}
