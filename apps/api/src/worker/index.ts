import { createClient } from '@libsql/client/web'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql/web'
import { createApp } from '@/app'
import type { Config } from '@/config'
import { loadConfig } from '@/config'
import type { Db } from '@/db'
import * as schema from '@/db/schema'
import { createLogger } from '@/logger'
import { payMethods, syncUsdt } from '@/modules/shop/payments'
import { spaIndex } from '@/shared/lib/spa'

/** Bindings and vars from wrangler.jsonc; the string vars feed `loadConfig`. */
interface Env {
  ASSETS: Fetcher
  /** D1, used when `DATABASE_URL` is unset. */
  DB?: D1Database
  [key: string]: unknown
}

/** Turso when `DATABASE_URL` is set, else the D1 binding; migrated out of band. */
function openDb(env: Env, config: Config): Db {
  if (config.DATABASE_URL)
    return drizzleLibsql(
      createClient({
        url: config.DATABASE_URL,
        authToken: config.DATABASE_AUTH_TOKEN,
      }),
      { schema },
    )
  if (env.DB) return drizzleD1(env.DB, { schema })
  throw new Error('no database: bind D1 as DB or set DATABASE_URL')
}

let deps: { config: Config; db: Db; app: ReturnType<typeof createApp> }

function build(env: Env) {
  if (deps) return deps
  const config = loadConfig(env as Record<string, string | undefined>)
  const db = openDb(env, config)
  const app = createApp({ config, db, logger: createLogger(config.LOG_LEVEL) })
  deps = { config, db, app }
  return deps
}

export default {
  /**
   * Static files are answered by Workers Assets before this runs; only `/api`
   * and asset misses arrive here. A miss gets its SPA's `index.html`.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/'))
      return build(env).app.fetch(request, env, ctx)
    if (request.method !== 'GET' && request.method !== 'HEAD')
      return new Response('Not Found', { status: 404 })
    return env.ASSETS.fetch(new URL(spaIndex(url.pathname), url))
  },
  /** Cron Trigger: settles USDT orders against confirmed transfers. */
  async scheduled(_controller, env, ctx) {
    const { config, db } = build(env)
    if (!payMethods(config).includes('usdt')) return
    const logger = createLogger(config.LOG_LEVEL)
    ctx.waitUntil(
      syncUsdt(db, config, fetch).catch((err) =>
        logger.error({ err }, 'usdt sync failed'),
      ),
    )
  },
} satisfies ExportedHandler<Env>
