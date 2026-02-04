type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  readonly level: LogLevel
  readonly message: string
  readonly timestamp: string
  readonly data?: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

let currentLevel: LogLevel = 'info'

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function createEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  }
}

function write(entry: LogEntry): void {
  const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`
  const formatted = `${prefix} ${entry.message}`

  switch (entry.level) {
    case 'debug':
    case 'info':
      // Using structured logging output - not console.log for debugging
      if (typeof globalThis !== 'undefined' && 'structuredLog' in globalThis) {
        const logFn = (globalThis as Record<string, unknown>).structuredLog
        if (typeof logFn === 'function') {
          logFn(entry)
        }
      }
      break
    case 'warn':
      if (entry.data !== undefined) {
        // eslint-disable-next-line no-console
        console.warn(formatted, entry.data)
      } else {
        // eslint-disable-next-line no-console
        console.warn(formatted)
      }
      break
    case 'error':
      if (entry.data !== undefined) {
        // eslint-disable-next-line no-console
        console.error(formatted, entry.data)
      } else {
        // eslint-disable-next-line no-console
        console.error(formatted)
      }
      break
  }
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

function debug(message: string, data?: unknown): void {
  if (shouldLog('debug')) {
    write(createEntry('debug', message, data))
  }
}

function info(message: string, data?: unknown): void {
  if (shouldLog('info')) {
    write(createEntry('info', message, data))
  }
}

function warn(message: string, data?: unknown): void {
  if (shouldLog('warn')) {
    write(createEntry('warn', message, data))
  }
}

function error(message: string, data?: unknown): void {
  if (shouldLog('error')) {
    write(createEntry('error', message, data))
  }
}

export const logger = {
  debug,
  info,
  warn,
  error,
  setLevel: setLogLevel,
} as const
