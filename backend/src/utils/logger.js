/**
 * Lightweight console logger with timestamp + level.
 * Swap this out for winston/pino if you need file/transport logging later.
 */
const log = (level, message) => {
  const timestamp = new Date().toISOString()
  console[level === 'error' ? 'error' : 'log'](`[${timestamp}] ${level.toUpperCase()}: ${message}`)
}

export default {
  info: (msg) => log('info', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('error', msg),
}
