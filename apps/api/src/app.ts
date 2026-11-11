import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import type { Config } from '@/config'
import type { Db } from '@/db'
import type { Logger } from '@/logger'
import { adminRoutes } from '@/modules/admin/admin.routes'
import { mountDocs } from '@/modules/docs/docs.routes'
import { healthRoutes } from '@/modules/health/health.routes'
import { shopRoutes } from '@/modules/shop/shop.routes'
import { taskRoutes } from '@/modules/tasks/tasks.routes'
import { root } from '@/root'
import { AppError, NotFoundError } from '@/shared/lib/errors'
import type { AppEnv } from '@/shared/lib/types'

export interface AppDeps {
  config: Config
  db: Db
  logger: Logger
  /** Built SPA directory served in production. */
  webDir?: string
  /** Outbound HTTP used by payment providers. */
  fetch?: typeof fetch
}

export function createApp({
  config,
  db,
  logger,
  webDir = root.web(),
  fetch: fetcher,
}: AppDeps) {
  const api = new Hono<AppEnv>()

  api.use('*', requestId())
  api.use('*', secureHeaders())
  if (config.CORS_ORIGINS.length)
    api.use(
      '*',
      cors({
        origin: config.CORS_ORIGINS,
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: 600,
      }),
    )
  api.use('*', async (c, next) => {
    c.set('config', config)
    c.set('db', db)
    c.set('logger', logger)
    const start = performance.now()
    await next()
    logger.info(
      {
        reqId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
      },
      'request',
    )
  })

  mountDocs(api, config)
  api.route('/', healthRoutes())
  api.route('/', taskRoutes())
  api.route('/', shopRoutes(fetcher))
  if (config.ADMIN_TOKEN) api.route('/', adminRoutes(config.ADMIN_TOKEN))
  api.all('*', () => {
    throw new NotFoundError()
  })

  const app = new Hono<AppEnv>()
  app.route('/api', api)

  const indexHtml = join(webDir, 'index.html')
  if (config.NODE_ENV === 'production' && existsSync(indexHtml)) {
    app.use('*', serveStatic({ root: webDir }))
    app.get('*', (c) => c.html(Bun.file(indexHtml).text()))
  }

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message, details: err.details },
        },
        err.status,
      )
    }
    logger.error({ err }, 'unhandled error')
    return c.json(
      {
        success: false,
        error: { code: 'INTERNAL', message: 'Internal server error' },
      },
      500,
    )
  })

  return app
}
