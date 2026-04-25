import test from 'node:test'
import assert from 'node:assert/strict'

import { extractDistrict } from './jobCard.helpers.js'

test('extractDistrict normalizes микрорайон addresses to short form', () => {
  assert.equal(extractDistrict('5 микрорайон, БЦ Орда'), '5 мкр')
})

test('extractDistrict recognizes Новый город marker', () => {
  assert.equal(extractDistrict('Новый город, дом 12'), 'Новый город')
})

test('extractDistrict falls back to a trimmed address snippet', () => {
  assert.equal(extractDistrict('Промзона 3, склад 7, Актау'), 'Промзона 3, склад 7, Акта')
})
