import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'path'

import { assertWhatsAppReady, getWhatsAppDataPath } from './whatsapp.helpers.js'

test('getWhatsAppDataPath uses a repo-local auth directory outside Windows', () => {
  const cwd = '/tmp/workgo'

  assert.equal(
    getWhatsAppDataPath({ cwd, platform: 'darwin', env: {} }),
    path.join(cwd, '.wwebjs_auth')
  )
})

test('getWhatsAppDataPath keeps the Windows data path on win32', () => {
  assert.equal(
    getWhatsAppDataPath({ cwd: '/tmp/workgo', platform: 'win32', env: {} }),
    'C:\\wwebjs_workgo'
  )
})

test('getWhatsAppDataPath honors WA_DATA_PATH overrides', () => {
  assert.equal(
    getWhatsAppDataPath({
      cwd: '/tmp/workgo',
      platform: 'darwin',
      env: { WA_DATA_PATH: '/custom/wa-data' },
    }),
    '/custom/wa-data'
  )
})

test('assertWhatsAppReady throws when the client is offline', () => {
  assert.throws(
    () => assertWhatsAppReady(false),
    /WhatsApp not connected yet/
  )
})
