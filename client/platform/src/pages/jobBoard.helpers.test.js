import test from 'node:test'
import assert from 'node:assert/strict'

import { buildDisplayJobs } from './jobBoard.helpers.js'

test('buildDisplayJobs attaches match metadata for matched results', () => {
  assert.deepEqual(
    buildDisplayJobs(
      [{ id: 'job-1', title: 'Бариста' }],
      [{ job: { id: 'job-1', title: 'Бариста' }, score: 91, reason: 'Есть опыт работы с гостями' }],
    ),
    [{ id: 'job-1', title: 'Бариста', _matchScore: 91, _matchReason: 'Есть опыт работы с гостями' }],
  )
})

test('buildDisplayJobs returns plain jobs when no matches are active', () => {
  assert.deepEqual(buildDisplayJobs([{ id: 'job-2', title: 'Кассир' }], null), [{ id: 'job-2', title: 'Кассир' }])
})
