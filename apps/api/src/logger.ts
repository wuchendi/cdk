const LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
type Level = (typeof LEVELS)[number]
type LogFn = (fields: Record<string, unknown> | string, msg?: string) => void

const plain = (value: unknown) =>
  value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack }
    : value

/** JSON lines on the console; works under Bun and on Workers. */
export function createLogger(level: string) {
  const min = LEVELS.indexOf(level as Level)
  const log =
    (at: Level): LogFn =>
    (fields, msg) => {
      if (min < 0 || LEVELS.indexOf(at) < min) return
      const extra = typeof fields === 'string' ? {} : fields
      const line = JSON.stringify(
        {
          level: at,
          time: Date.now(),
          msg: typeof fields === 'string' ? fields : msg,
          ...extra,
        },
        (_, v) => plain(v),
      )
      if (at === 'error' || at === 'fatal') console.error(line)
      else if (at === 'warn') console.warn(line)
      else console.log(line)
    }
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
  }
}

export type Logger = ReturnType<typeof createLogger>
