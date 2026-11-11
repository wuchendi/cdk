import pino from 'pino'

export function createLogger(level: string) {
  return pino({
    level,
    redact: ['req.headers.authorization', 'req.headers["x-cdkey"]'],
  })
}

export type Logger = ReturnType<typeof createLogger>
