import test from 'node:test'
import assert from 'node:assert/strict'

import { toggleFilter } from './filterBar.helpers.js'

test('toggleFilter sets a filter value when it is not active', () => {
  assert.deepEqual(toggleFilter({ search: 'кассир' }, 'district', '1-й мкр'), {
    search: 'кассир',
    district: '1-й мкр',
  })
})

test('toggleFilter clears a filter when the same value is clicked again', () => {
  assert.deepEqual(toggleFilter({ district: '1-й мкр', search: 'кассир' }, 'district', '1-й мкр'), {
    district: '',
    search: 'кассир',
  })
})
