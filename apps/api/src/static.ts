import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { MiddlewareHandler } from 'hono'
import { serveStatic } from 'hono/bun'
import { spaIndex } from '@/shared/lib/spa'

/** Serves the built SPAs from `dir` under Bun, falling back to each SPA's index. */
export function spaAssets(dir: string): MiddlewareHandler | undefined {
  if (!existsSync(join(dir, 'index.html'))) return undefined
  const files = serveStatic({ root: dir })
  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next()
    return files(c, async () => {
      const index = Bun.file(join(dir, spaIndex(c.req.path)))
      c.res = c.html(await index.text())
    })
  }
}
