import test from 'node:test'
import assert from 'node:assert/strict'

import { STATUS_LABEL, filterBusinesses, getBusinessInitials } from './admin.helpers.js'

test('filterBusinesses matches name and category case-insensitively', () => {
  const businesses = [
    { name: 'Laguna Cafe', category: 'Кафе' },
    { name: 'Nursat Market', category: 'Магазин' },
  ]

  assert.deepEqual(filterBusinesses(businesses, 'cafe'), [{ name: 'Laguna Cafe', category: 'Кафе' }])
  assert.deepEqual(filterBusinesses(businesses, 'магаз'), [{ name: 'Nursat Market', category: 'Магазин' }])
})

test('getBusinessInitials builds two-letter initials from the business name', () => {
  assert.equal(getBusinessInitials('Laguna Cafe'), 'LC')
  assert.equal(getBusinessInitials('Nursat'), 'N')
})

test('STATUS_LABEL exposes the user-facing admin labels', () => {
  assert.equal(STATUS_LABEL.DISCOVERED, 'Не связались')
  assert.equal(STATUS_LABEL.COMPLETED, 'Готово')
})
