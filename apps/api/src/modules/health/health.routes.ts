import type { HealthStatus } from '@cdk/shared'
import { Hono } from 'hono'
import * as z from 'zod'
import { describeRoute, jsonOk, TAGS } from '@/shared/lib/openapi'
import type { AppEnv } from '@/shared/lib/types'

const healthSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  uptime: z.number(),
})

export function healthRoutes() {
  const router = new Hono<AppEnv>()

  router.get(
    '/health',
    describeRoute({
      tags: [TAGS.System],
      summary: 'Health check',
      responses: jsonOk(healthSchema, 'Service is healthy'),
    }),
    (c) => {
      const data: HealthStatus = {
        status: 'ok',
        version: c.get('config').VERSION,
        uptime: Math.round(process.uptime()),
      }
      return c.json({ success: true as const, data })
    },
  )

  return router
}
