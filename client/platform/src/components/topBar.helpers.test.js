import test from 'node:test'
import assert from 'node:assert/strict'

import { getTopBarLinks } from './topBar.helpers.js'

test('getTopBarLinks returns the canonical WorkGo navigation', () => {
  assert.deepEqual(getTopBarLinks(), [
    { to: '/', label: 'Вакансии', end: true },
    { to: '/profile', label: 'Профиль' },
    { to: '/employer', label: 'Для работодателей' },
    { to: '/admin', label: 'Агент' },
  ])
})
