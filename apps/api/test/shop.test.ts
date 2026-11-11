import { afterAll, describe, expect, it } from 'bun:test'
import { createSign, createVerify, generateKeyPairSync } from 'node:crypto'
import type { ShopCatalog, ShopOrder } from '@cdk/shared'
import { eq } from 'drizzle-orm'
import { createApp } from '@/app'
import { loadConfig } from '@/config'
import { createDb } from '@/db'
import { cdkeys, orders } from '@/db/schema'
import { createLogger } from '@/logger'
import { syncUsdt, USDT_CONTRACT } from '@/modules/shop/payments'

const der = (key: { export: (o: object) => Buffer }, type: string) =>
  key.export({ format: 'der', type }).toString('base64')
const merchant = generateKeyPairSync('rsa', { modulusLength: 2048 })
const alipay = generateKeyPairSync('rsa', { modulusLength: 2048 })
const config = loadConfig({
  NODE_ENV: 'test',
  APP_URL: 'https://api.example.com',
  CORS_ORIGINS: 'https://shop.example.com',
  ALIPAY_APP_ID: 'app-1',
  ALIPAY_PRIVATE_KEY: der(merchant.privateKey, 'pkcs8'),
  ALIPAY_PUBLIC_KEY: der(alipay.publicKey, 'spki'),
  USDT_TRC20_ADDRESS: 'TReceiver',
  USDT_CNY_RATE: '8',
})

const canonical = (params: Record<string, string>, skip: string[]) =>
  Object.keys(params)
    .filter((k) => !skip.includes(k))
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
let transfers: unknown[] = []
let gatewayDown = false
const gatewayCalls: Record<string, string>[] = []
const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input)
  if (url.startsWith(config.TRONGRID_URL))
    return Response.json({ data: transfers })
  const params = Object.fromEntries(new URLSearchParams(String(init?.body)))
  gatewayCalls.push(params)
  const signed = createVerify('RSA-SHA256')
    .update(canonical(params, ['sign']))
    .verify(merchant.publicKey, params.sign ?? '', 'base64')
  return Response.json({
    alipay_trade_precreate_response:
      signed && !gatewayDown
        ? { code: '10000', qr_code: 'https://qr.alipay.com/test' }
        : { code: '40004' },
  })
}) as typeof fetch

const { db, close } = createDb(':memory:')
const logger = createLogger('silent')
const app = createApp({ config, db, logger, fetch: fetcher })
afterAll(close)

async function call<T>(path: string, method = 'GET', body?: unknown) {
  const res = await app.request(`/api/shop${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const json = (await res.json()) as {
    data: T
    error?: { code: string }
  }
  return { status: res.status, data: json.data, code: json.error?.code }
}
const guest = { email: 'Buyer@Example.com', password: 'order-pass' }
const buy = (extra: object) =>
  call<ShopOrder>('/orders', 'POST', { productId: 1, ...extra })
function notify(fields: Record<string, string>, key = alipay.privateKey) {
  const params: Record<string, string> = {
    app_id: 'app-1',
    trade_status: 'TRADE_SUCCESS',
    sign_type: 'RSA2',
    ...fields,
  }
  params.sign = createSign('RSA-SHA256')
    .update(canonical(params, ['sign', 'sign_type']))
    .sign(key, 'base64')
  return app.request('/api/shop/payments/alipay/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
}
const keysOf = (orderNo: string) =>
  db
    .select({ code: cdkeys.code, balance: cdkeys.balance })
    .from(cdkeys)
    .innerJoin(orders, eq(cdkeys.orderId, orders.id))
    .where(eq(orders.orderNo, orderNo))
    .all()

describe('catalog and CORS', () => {
  it('lists seeded products and configured methods', async () => {
    const { data } = await call<ShopCatalog>('/catalog')
    expect(data.methods).toEqual(['alipay', 'usdt'])
    expect(data.products[0]).toMatchObject({ credits: 1, price: 800, sold: 0 })
  })
  it('offers no methods when nothing is configured', async () => {
    const bare = createApp({
      config: loadConfig({ NODE_ENV: 'test' }),
      db,
      logger,
    })
    const res = await bare.request('/api/shop/catalog', {
      headers: { Origin: 'https://shop.example.com' },
    })
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull()
    const body = (await res.json()) as { data: ShopCatalog }
    expect(body.data.methods).toEqual([])
  })
  it('allows only configured origins', async () => {
    const from = (Origin: string) =>
      app.request('/api/shop/catalog', { headers: { Origin } })
    expect(
      (await from('https://shop.example.com')).headers.get(
        'Access-Control-Allow-Origin',
      ),
    ).toBe('https://shop.example.com')
    expect(
      (await from('https://evil.example.com')).headers.get(
        'Access-Control-Allow-Origin',
      ),
    ).toBeNull()
  })
})

describe('orders', () => {
  it('validates guest orders', async () => {
    expect((await buy({ method: 'alipay' })).status).toBe(422)
    expect(
      (await buy({ method: 'alipay', ...guest, quantity: 0 })).status,
    ).toBe(422)
    expect(
      (await buy({ method: 'alipay', ...guest, productId: 999 })).status,
    ).toBe(404)
    expect((await buy({ method: 'alipay', email: guest.email })).status).toBe(
      422,
    )
    expect((await call('/auth/register', 'POST', guest)).status).toBe(404)
    expect((await call('/orders')).status).toBe(404)
  })
  it('prices an alipay order on the server and returns the QR link', async () => {
    const { data } = await buy({ method: 'alipay', quantity: 2, ...guest })
    expect(data).toMatchObject({
      quantity: 2,
      amount: 1600,
      payAmount: 1600,
      status: 'pending',
      payTarget: 'https://qr.alipay.com/test',
      keys: [],
    })
    const sent = gatewayCalls.at(-1)
    expect(sent?.notify_url).toBe(
      'https://api.example.com/api/shop/payments/alipay/notify',
    )
    expect(JSON.parse(sent?.biz_content ?? '{}')).toMatchObject({
      out_trade_no: data.orderNo,
      total_amount: '16.00',
    })
  })
  it('drops the order when the gateway refuses it', async () => {
    gatewayDown = true
    const before = db.select().from(orders).all().length
    expect((await buy({ method: 'alipay', ...guest })).code).toBe(
      'PAYMENT_UNAVAILABLE',
    )
    gatewayDown = false
    expect(db.select().from(orders).all()).toHaveLength(before)
  })
  it('rejects forged, foreign and underpaid callbacks', async () => {
    const { data } = await buy({ method: 'alipay', ...guest })
    const fields = {
      out_trade_no: data.orderNo,
      total_amount: '8.00',
      trade_no: 'T-forged',
    }
    expect((await notify(fields, merchant.privateKey)).status).toBe(400)
    expect((await notify({ ...fields, app_id: 'other' })).status).toBe(400)
    expect((await notify({ ...fields, total_amount: '0.01' })).status).toBe(400)
    expect((await notify({ ...fields, out_trade_no: 'missing' })).status).toBe(
      400,
    )
    const waiting = await notify({ ...fields, trade_status: 'WAIT_BUYER_PAY' })
    expect(await waiting.text()).toBe('success')
    expect(keysOf(data.orderNo)).toHaveLength(0)
  })
  it('issues keys exactly once for a valid callback', async () => {
    const { data } = await buy({ method: 'alipay', quantity: 2, ...guest })
    const fields = {
      out_trade_no: data.orderNo,
      total_amount: '16.00',
      trade_no: 'T-1',
    }
    const res = await notify(fields)
    expect(await res.text()).toBe('success')
    expect((await notify(fields)).status).toBe(200)
    const keys = keysOf(data.orderNo)
    expect(keys).toHaveLength(2)
    expect(keys[0]?.balance).toBe(1)
    expect(keys[0]?.code).toMatch(/^CDK(-[0-9A-Z]{5}){4}$/)
    const paid = await call<ShopOrder>(`/orders/${data.orderNo}`)
    expect(paid.data.status).toBe('paid')
    expect(paid.data.payTarget).toBeNull()
    expect(paid.data.keys.sort()).toEqual(keys.map((k) => k.code).sort())
    const session = await app.request('/api/session', {
      headers: { Authorization: `Bearer ${keys[0]?.code}` },
    })
    expect(session.status).toBe(200)
    const catalog = await call<ShopCatalog>('/catalog')
    expect(catalog.data.products[0]?.sold).toBe(2)
  })
  it('finds guest orders by email and order password only', async () => {
    const found = await call<ShopOrder[]>('/orders/lookup', 'POST', {
      email: 'buyer@example.com',
      password: 'order-pass',
    })
    expect(found.data.length).toBeGreaterThan(1)
    const wrong = await call<ShopOrder[]>('/orders/lookup', 'POST', {
      email: 'buyer@example.com',
      password: 'not-the-pass',
    })
    expect(wrong.data).toEqual([])
    expect((await call('/orders/unknown')).status).toBe(404)
  })
  it('shows expired orders without a payment target', async () => {
    const { data } = await buy({ method: 'alipay', ...guest })
    db.update(orders)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(orders.orderNo, data.orderNo))
      .run()
    const { data: expired } = await call<ShopOrder>(`/orders/${data.orderNo}`)
    expect(expired).toMatchObject({ status: 'expired', payTarget: null })
  })
})

describe('usdt', () => {
  const transfer = (value: number, id: string, extra: object = {}) => ({
    transaction_id: id,
    to: 'TReceiver',
    type: 'Transfer',
    value: String(value),
    block_timestamp: Date.now() + 1000,
    token_info: { address: USDT_CONTRACT },
    ...extra,
  })
  it('gives concurrent orders distinct amounts', async () => {
    const a = await buy({ method: 'usdt', ...guest })
    const b = await buy({ method: 'usdt', ...guest })
    expect(a.data).toMatchObject({
      payAmount: 1_000_000,
      payTarget: 'TReceiver',
    })
    expect(b.data.payAmount).toBe(1_000_100)
  })
  it('settles only exact, in-window transfers to the address', async () => {
    const pending = db
      .select()
      .from(orders)
      .where(eq(orders.payAmount, 1_000_100))
      .get()
    const orderNo = pending?.orderNo ?? ''
    transfers = [
      transfer(1_000_100, 'tx-other-token', {
        token_info: { address: 'TFake' },
      }),
      transfer(1_000_100, 'tx-other-address', { to: 'TSomeoneElse' }),
      transfer(1_000_100, 'tx-early', { block_timestamp: 1000 }),
      transfer(1_000_200, 'tx-wrong-amount'),
    ]
    expect(await syncUsdt(db, config, fetcher)).toBe(0)
    expect(keysOf(orderNo)).toHaveLength(0)
    transfers = [transfer(1_000_100, 'tx-good')]
    expect(await syncUsdt(db, config, fetcher)).toBe(1)
    expect(await syncUsdt(db, config, fetcher)).toBe(0)
    expect(keysOf(orderNo)).toHaveLength(1)
  })
  it('never settles two orders with one transaction', async () => {
    const { data } = await buy({ method: 'usdt', ...guest })
    transfers = [transfer(data.payAmount, 'tx-good')]
    expect(await syncUsdt(db, config, fetcher)).toBe(0)
    expect(keysOf(data.orderNo)).toHaveLength(0)
  })
})

describe('mock payment', () => {
  const mockApp = (NODE_ENV: string) =>
    createApp({
      config: loadConfig({ NODE_ENV, SHOP_MOCK_PAY: 'true' }),
      db,
      logger,
    })
  const send = async <T>(
    target: ReturnType<typeof mockApp>,
    path: string,
    body?: unknown,
  ) => {
    const res = await target.request(`/api/shop${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const json = (await res.json()) as { data: T; error?: { code: string } }
    return { status: res.status, data: json.data, code: json.error?.code }
  }
  const order = { productId: 1, method: 'mock', ...guest }

  it('is offered only in development with the flag set', async () => {
    const methods = async (target: ReturnType<typeof mockApp>) => {
      const res = await target.request('/api/shop/catalog')
      return ((await res.json()) as { data: ShopCatalog }).data.methods
    }
    expect(await methods(mockApp('development'))).toEqual(['mock'])
    expect(await methods(mockApp('production'))).toEqual([])
    expect(await methods(mockApp('test'))).toEqual([])
    expect((await send(mockApp('production'), '/orders', order)).code).toBe(
      'METHOD_UNAVAILABLE',
    )
    expect((await buy({ method: 'mock', ...guest })).code).toBe(
      'METHOD_UNAVAILABLE',
    )
  })
  it('settles a mock order once and nothing else', async () => {
    const dev = mockApp('development')
    const { data } = await send<ShopOrder>(dev, '/orders', order)
    expect(data).toMatchObject({
      method: 'mock',
      payAmount: 800,
      payTarget: null,
    })
    const pay = `/orders/${data.orderNo}/mock-pay`
    expect((await send(mockApp('production'), pay)).status).toBe(404)
    expect((await call(pay, 'POST')).status).toBe(404)
    const paid = await send<ShopOrder>(dev, pay)
    expect(paid.data.status).toBe('paid')
    expect(paid.data.keys).toHaveLength(1)
    expect((await send(dev, pay)).code).toBe('ORDER_NOT_PENDING')
    expect(keysOf(data.orderNo)).toHaveLength(1)
    const real = await buy({ method: 'alipay', ...guest })
    expect(
      (await send(dev, `/orders/${real.data.orderNo}/mock-pay`)).status,
    ).toBe(404)
    expect((await send(dev, '/orders/unknown/mock-pay')).status).toBe(404)
  })
})
