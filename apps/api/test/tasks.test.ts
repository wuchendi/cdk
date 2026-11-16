import { afterAll, describe, expect, it } from 'bun:test'
import type { TaskList } from '@cdk/shared'
import { eq } from 'drizzle-orm'
import { createApp } from '@/app'
import { loadConfig } from '@/config'
import { createDb } from '@/db/bun'
import { cdkeys, tasks } from '@/db/schema'
import { createLogger } from '@/logger'

const { db, close } = await createDb(':memory:')
const app = createApp({
  config: loadConfig({ NODE_ENV: 'test' }),
  db,
  logger: createLogger('silent'),
})
await db
  .insert(cdkeys)
  .values([
    { code: 'alpha', balance: 3 },
    { code: 'beta', balance: 0 },
  ])
  .run()
afterAll(close)
const request = (path: string, method = 'GET', body?: unknown, key = 'alpha') =>
  app.request(`/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

describe('task management', () => {
  it('rejects unknown and absent keys', async () => {
    expect(
      (await request('/session', 'GET', undefined, 'invalid')).status,
    ).toBe(401)
    expect((await app.request('/api/tasks')).status).toBe(401)
  })
  it('validates task inputs and balance without charging', async () => {
    const bad = (credential: string, key = 'alpha') =>
      request('/tasks', 'POST', { credential, taskType: 'sub6' }, key)
    expect((await bad('a@example.com')).status).toBe(422)
    expect((await bad('a@example.com----pw')).status).toBe(422)
    expect((await bad('bad----pw----JBSWY3DPEHPK3PXP')).status).toBe(422)
    expect((await bad('a@example.com----pw----short')).status).toBe(422)
    expect(
      (await bad('a@example.com----pw----JBSWY3DPEHPK3PXP', 'beta')).status,
    ).toBe(409)
    expect(
      (
        (await (await request('/session')).json()) as {
          data: { balance: number }
        }
      ).data.balance,
    ).toBe(3)
  })
  it('creates, isolates, filters and cancels a task with one refund', async () => {
    const body = {
      credential: 'A@example.com---- My Pass ----jbsw y3dp ehpk 3pxp',
      taskType: 'sub12',
    }
    const created = await request('/tasks', 'POST', body)
    expect(created.status).toBe(200)
    const task = (
      (await created.json()) as {
        data: { id: number; status: string; email: string }
      }
    ).data
    expect(task.status).toBe('pending')
    expect(task.email).toBe('a@example.com')
    expect(task).not.toHaveProperty('password')
    const stored = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, task.id))
      .get()
    expect(stored).toMatchObject({
      email: 'a@example.com',
      password: 'My Pass',
      totpSecret: 'JBSWY3DPEHPK3PXP',
    })
    expect((await request('/tasks', 'POST', body)).status).toBe(409)
    expect(
      (
        (await (await request('/session')).json()) as {
          data: { balance: number }
        }
      ).data.balance,
    ).toBe(1.5)
    expect(
      (
        (await (await request('/tasks', 'GET', undefined, 'beta')).json()) as {
          data: TaskList
        }
      ).data.items,
    ).toEqual([])
    expect(
      (
        (await (await request('/tasks?search=missing')).json()) as {
          data: TaskList
        }
      ).data.total,
    ).toBe(0)
    expect(
      (
        (await (
          await request('/tasks?status=pending&search=a%40example')
        ).json()) as { data: TaskList }
      ).data.total,
    ).toBe(1)
    expect(
      (await request(`/tasks/${task.id}`, 'DELETE', undefined, 'beta')).status,
    ).toBe(404)
    expect((await request(`/tasks/${task.id}`, 'DELETE')).status).toBe(200)
    expect((await request(`/tasks/${task.id}`, 'DELETE')).status).toBe(404)
    expect(
      (
        (await (await request('/session')).json()) as {
          data: { balance: number }
        }
      ).data.balance,
    ).toBe(3)
  })
  it('cannot cancel running work and validates query and ids', async () => {
    const row = await db
      .insert(tasks)
      .values({
        cdkeyId: 1,
        email: 'running@example.com',
        taskType: 'sub6',
        status: 'running',
      })
      .returning()
      .get()
    expect((await request(`/tasks/${row.id}`, 'DELETE')).status).toBe(409)
    expect((await request('/tasks/abc', 'DELETE')).status).toBe(422)
    expect((await request('/tasks?status=unknown')).status).toBe(422)
    expect((await request('/tasks?page=0')).status).toBe(422)
  })
  it('debits once for concurrent duplicates and refunds once for concurrent cancels', async () => {
    await db.insert(cdkeys).values({ code: 'gamma', balance: 1 }).run()
    const submit = () =>
      request(
        '/tasks',
        'POST',
        {
          credential: 'race@example.com----pw----JBSWY3DPEHPK3PXP',
          taskType: 'sub6',
        },
        'gamma',
      )
    const results = await Promise.all([submit(), submit(), submit()])
    const codes = await Promise.all(
      results.map(async (r) =>
        r.status === 200
          ? 'ok'
          : ((await r.json()) as { error: { code: string } }).error.code,
      ),
    )
    expect(codes.filter((c) => c === 'ok')).toHaveLength(1)
    expect(codes.filter((c) => c !== 'ok')).toEqual([
      'DUPLICATE_TASK',
      'DUPLICATE_TASK',
    ])
    const balance = async () =>
      (await db.select().from(cdkeys).where(eq(cdkeys.code, 'gamma')).get())
        ?.balance
    expect(await balance()).toBe(0)
    const other = await request(
      '/tasks',
      'POST',
      {
        credential: 'other@example.com----pw----JBSWY3DPEHPK3PXP',
        taskType: 'sub6',
      },
      'gamma',
    )
    expect(
      ((await other.json()) as { error: { code: string } }).error.code,
    ).toBe('INSUFFICIENT_BALANCE')
    const created = results.find((r) => r.status === 200)
    const { id } = ((await created?.json()) as { data: { id: number } }).data
    const cancels = await Promise.all([
      request(`/tasks/${id}`, 'DELETE', undefined, 'gamma'),
      request(`/tasks/${id}`, 'DELETE', undefined, 'gamma'),
    ])
    expect(cancels.filter((r) => r.status === 200)).toHaveLength(1)
    expect(await balance()).toBe(1)
  })
  it('documents the protected endpoints', async () => {
    const spec = (await (await app.request('/api/openapi.json')).json()) as {
      paths: Record<string, { get?: unknown; post?: unknown }>
    }
    expect(spec.paths['/tasks']?.post).toBeDefined()
    expect(spec.paths['/session']?.get).toBeDefined()
  })
})
