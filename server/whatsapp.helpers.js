import path from 'path'

export function getWhatsAppDataPath({
  cwd = process.cwd(),
  platform = process.platform,
  env = process.env,
} = {}) {
  if (env.WA_DATA_PATH) return env.WA_DATA_PATH
  if (platform === 'win32') return 'C:\\wwebjs_workgo'
  return path.join(cwd, '.wwebjs_auth')
}

export function assertWhatsAppReady(isReady) {
  if (!isReady) {
    throw new Error('WhatsApp not connected yet')
  }
}
