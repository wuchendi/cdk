import { afterAll, describe, expect, it } from 'bun:test'
import type {
  AdminOrderList,
  AdminProduct,
  AdminTaskList,
  ShopCatalog,
  ShopOrder,
} from '@cdk/shared'
import { eq } from 'drizzle-orm'
import { createApp } from '@/app'
import { loadConfig } from '@/config'
import { createDb } from '@/db'
import { cdkeys, orders } from '@/db/schema'
import { createLogger } from '@/logger'

const TOKEN = 'admin-token-0123456789'
const { db, close } = createDb(':memory:')
const logger = createLogger('silent')
const app = createApp({
  config: loadConfig({
    NODE_ENV: 'development',
    ADMIN_TOKEN: TOKEN,
    SHOP_MOCK_PAY: 'true',
  }),
  db,
  logger,
})
afterAll(close)

async function call<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  token: string | null = TOKEN,
) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = (await res.json()) as { data: T; error?: { code: string } }
  return { status: res.status, data: json.data, code: json.error?.code }
}
const catalog = async () =>
  (await call<ShopCatalog>('/shop/catalog')).data.products
const buy = async (email: string) =>
  (
    await call<ShopOrder>('/shop/orders', 'POST', {
      productId: 1,
      method: 'mock',
      email,
      password: 'order-pass',
    })
  ).data

describe('admin access', () => {
  it('does not exist without a configured token', async () => {
    const closed = createApp({
      config: loadConfig({ NODE_ENV: 'test' }),
      db,
      logger,
    })
    const res = await closed.request('/api/admin/products', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    })
    expect(res.status).toBe(404)
  })
  it('rejects short tokens in config and wrong tokens at runtime', async () => {
    expect(() => loadConfig({ ADMIN_TOKEN: 'short' })).toThrow()
    expect((await call('/admin/session', 'GET', undefined, null)).status).toBe(
      401,
    )
    expect(
      (await call('/admin/products', 'GET', undefined, `${TOKEN}x`)).status,
    ).toBe(401)
    expect((await call('/admin/session')).status).toBe(200)
  })
})

describe('admin products', () => {
  it('lists every product with its listing state', async () => {
    const { data } = await call<AdminProduct[]>('/admin/products')
    expect(data).toHaveLength(3)
    expect(data[0]).toMatchObject({ id: 1, active: true, sort: 1, sold: 0 })
  })
  it('creates, edits, unlists and relists a product', async () => {
    const draft = {
      name: '充值 CDK（5 额度）',
      description: '',
      credits: 5,
      price: 4000,
      sort: 0,
      active: false,
    }
    const created = await call<AdminProduct>('/admin/products', 'POST', draft)
    expect(created.data).toMatchObject(draft)
    const id = created.data.id
    expect((await catalog()).some((p) => p.id === id)).toBe(false)
    const listed = await call<AdminProduct>(`/admin/products/${id}`, 'PATCH', {
      active: true,
      price: 3900,
    })
    expect(listed.data).toMatchObject({ active: true, price: 3900, credits: 5 })
    expect((await catalog())[0]).toMatchObject({ id, price: 3900 })
    const unlisted = await call<AdminProduct>(
      `/admin/products/${id}`,
      'PATCH',
      {
        active: false,
      },
    )
    expect(unlisted.data).toMatchObject({ active: false, price: 3900 })
    const renamed = await call<AdminProduct>(`/admin/products/${id}`, 'PATCH', {
      name: '五额度',
    })
    expect(renamed.data).toMatchObject({ name: '五额度', active: false })
    expect((await catalog()).some((p) => p.id === id)).toBe(false)
  })
  it('validates product input', async () => {
    const bad = (body: object) => call('/admin/products', 'POST', body)
    const base = { name: 'x', credits: 1, price: 100 }
    expect((await bad({ ...base, price: 0 })).status).toBe(422)
    expect((await bad({ ...base, price: 1.5 })).status).toBe(422)
    expect((await bad({ ...base, credits: 0 })).status).toBe(422)
    expect((await bad({ ...base, name: ' ' })).status).toBe(422)
    expect((await call('/admin/products/1', 'PATCH', {})).status).toBe(422)
    expect(
      (await call('/admin/products/999', 'PATCH', { active: false })).status,
    ).toBe(404)
  })
})

describe('admin orders', () => {
  it('filters, searches and settles orders by hand', async () => {
    const first = await buy('one@example.com')
    const second = await buy('two@example.com')
    const stale = await buy('old@example.com')
    db.update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.orderNo, stale.orderNo))
      .run()
    await call(`/shop/orders/${first.orderNo}/mock-pay`, 'POST')

    const list = (query: string) =>
      call<AdminOrderList>(`/admin/orders?${query}`)
    const all = await list('')
    expect(all.data).toMatchObject({ total: 3, page: 1 })
    expect(all.data.items[0]).toMatchObject({
      orderNo: stale.orderNo,
      email: 'old@example.com',
      status: 'expired',
    })
    const only = async (query: string) =>
      (await list(query)).data.items.map((o) => o.orderNo)
    expect(await only('status=paid')).toEqual([first.orderNo])
    expect(await only('status=pending')).toEqual([second.orderNo])
    expect(await only('status=expired')).toEqual([stale.orderNo])
    expect(await only('search=two@')).toEqual([second.orderNo])
    expect(await only(`search=${first.orderNo.slice(8, 20)}`)).toEqual([
      first.orderNo,
    ])
    expect((await list('status=nope')).status).toBe(422)

    const settle = (orderNo: string) =>
      call<ShopOrder>(`/admin/orders/${orderNo}/settle`, 'POST')
    const settled = await settle(stale.orderNo)
    expect(settled.data).toMatchObject({
      status: 'paid',
      tradeNo: expect.any(String),
    })
    expect(settled.data.keys).toHaveLength(1)
    expect((await settle(stale.orderNo)).code).toBe('ORDER_ALREADY_PAID')
    expect((await settle('missing')).status).toBe(404)
    expect(
      db.select().from(cdkeys).where(eq(cdkeys.balance, 1)).all(),
    ).toHaveLength(2)
    expect(
      (
        await call(
          `/admin/orders/${second.orderNo}/settle`,
          'POST',
          undefined,
          'bad',
        )
      ).status,
    ).toBe(401)
  })
})

describe('admin tasks', () => {
  it('lists credentials, filters, searches and updates status', async () => {
    db.insert(cdkeys).values({ code: 'taskkey', balance: 5 }).run()
    const submit = (credential: string) =>
      app.request('/api/tasks', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer taskkey',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential, taskType: 'sub6' }),
      })
    expect(
      (await submit('one@example.com----pw1----JBSWY3DPEHPK3PXP')).status,
    ).toBe(200)
    expect(
      (await submit('two@example.com----pw2----JBSWY3DPEHPK3PXP')).status,
    ).toBe(200)

    const list = await call<AdminTaskList>('/admin/tasks')
    expect(list.data.total).toBe(2)
    expect(list.data.items[0]).toMatchObject({
      email: 'two@example.com',
      password: 'pw2',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      cdkeyCode: 'taskkey',
      status: 'pending',
      completedAt: null,
    })
    const only = async (q: string) =>
      (await call<AdminTaskList>(`/admin/tasks?${q}`)).data.items.map(
        (t) => t.email,
      )
    expect(await only('search=one@')).toEqual(['one@example.com'])
    expect((await only('search=taskkey')).sort()).toEqual([
      'one@example.com',
      'two@example.com',
    ])
    expect(await only('status=running')).toEqual([])
    expect((await call('/admin/tasks?status=bad')).status).toBe(422)

    const id = list.data.items[0]?.id ?? 0
    const running = await call<AdminTaskList['items'][number]>(
      `/admin/tasks/${id}`,
      'PATCH',
      { status: 'running' },
    )
    expect(running.data).toMatchObject({ status: 'running', completedAt: null })
    const done = await call<AdminTaskList['items'][number]>(
      `/admin/tasks/${id}`,
      'PATCH',
      { status: 'success', message: 'done' },
    )
    expect(done.data.status).toBe('success')
    expect(done.data.message).toBe('done')
    expect(done.data.completedAt).not.toBeNull()
    expect(await only('status=success')).toEqual(['two@example.com'])
    expect(
      (await call('/admin/tasks/999999', 'PATCH', { status: 'failed' })).status,
    ).toBe(404)
    expect((await call('/admin/tasks', 'GET', undefined, 'bad')).status).toBe(
      401,
    )
  })
})
