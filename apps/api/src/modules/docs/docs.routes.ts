import type { Hono, MiddlewareHandler } from 'hono'
import { openAPIRouteHandler } from 'hono-openapi'
import type { Config } from '@/config'
import { TAGS } from '@/shared/lib/openapi'
import type { AppEnv } from '@/shared/lib/types'

export const DOCS_VIEWER = 'https://client.scalar.com/?url='

export function mountDocs(api: Hono<AppEnv>, config: Config): void {
  let handler: MiddlewareHandler | undefined

  api.get('/openapi.json', async (c, next) => {
    handler ??= openAPIRouteHandler(api, {
      documentation: {
        openapi: '3.1.0',
        info: { title: 'cdk API', version: config.VERSION },
        servers: [{ url: '/api' }],
        components: {
          securitySchemes: {
            cdkey: { type: 'http', scheme: 'bearer' },
            admin: { type: 'http', scheme: 'bearer' },
          },
        },
        tags: Object.values(TAGS).map((name) => ({ name })),
      },
      defaultValidationErrorResponse: false,
    })
    const res = await handler(c, next)
    res?.headers.set('Access-Control-Allow-Origin', '*')
    return res
  })

  api.get('/docs', (c) => {
    const origin = new URL(config.APP_URL ?? c.req.url).origin
    return c.redirect(
      `${DOCS_VIEWER}${encodeURIComponent(`${origin}/api/openapi.json`)}`,
    )
  })
}
