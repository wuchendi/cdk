import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from '@/app'
import { loadConfig } from '@/config'
import { createDb } from '@/db'
import { createLogger } from '@/logger'

const config = loadConfig({ NODE_ENV: 'test' })
const { db, close } = createDb(':memory:')
const app = createApp({
  config,
  db,
  logger: createLogger('silent'),
})

afterAll(() => close())

describe('api', () => {
  it('returns health status', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      data: { status: string; version: string }
    }
    expect(body.success).toBe(true)
    expect(body.data.status).toBe('ok')
    expect(body.data.version).toBe(config.VERSION)
  })

  it('serves the OpenAPI document', async () => {
    const res = await app.request('/api/openapi.json')
    expect(res.status).toBe(200)
    const spec = (await res.json()) as {
      openapi: string
      paths: Record<string, unknown>
    }
    expect(spec.openapi).toBe('3.1.0')
    expect(Object.keys(spec.paths)).toContain('/health')
  })

  it('redirects /docs to the spec viewer', async () => {
    const res = await app.request('http://localhost/api/docs')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain(
      encodeURIComponent('http://localhost/api/openapi.json'),
    )
  })

  it('answers unknown api routes with the error envelope', async () => {
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    const body = (await res.json()) as {
      success: boolean
      error: { code: string }
    }
    expect(body).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('migrates the schema', () => {
    const tables = db.$client
      .query("select name from sqlite_master where type = 'table'")
      .all() as { name: string }[]
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(['cdkeys', 'tasks']),
    )
  })
})

describe('config', () => {
  it('rejects invalid env', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow('Invalid environment')
  })
})

describe('production mode', () => {
  const webDir = mkdtempSync(join(tmpdir(), 'cdk-web-'))
  mkdirSync(join(webDir, 'assets'))
  writeFileSync(join(webDir, 'index.html'), '<title>spa</title>')
  writeFileSync(join(webDir, 'assets', 'app.js'), 'console.log(1)')
  const prod = createApp({
    config: loadConfig({ NODE_ENV: 'production' }),
    db,
    logger: createLogger('silent'),
    webDir,
  })

  afterAll(() => rmSync(webDir, { recursive: true, force: true }))

  it('keeps /api routes working alongside the SPA', async () => {
    const res = await prod.request('/api/health')
    expect(res.status).toBe(200)
  })

  it('serves built assets', async () => {
    const res = await prod.request('/assets/app.js')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('console.log(1)')
  })

  it('falls back to index.html for client routes', async () => {
    const res = await prod.request('/some/client/route')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('<title>spa</title>')
  })
})

describe('config', () => {
  it('treats an empty APP_URL as unset', () => {
    expect(loadConfig({ APP_URL: '' }).APP_URL).toBeUndefined()
  })
})
