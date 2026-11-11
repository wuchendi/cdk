import {
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  randomInt,
} from 'node:crypto'
import type { PayMethod } from '@cdk/shared'
import { and, eq, gt } from 'drizzle-orm'
import type { Config } from '@/config'
import type { Db } from '@/db'
import { cdkeys, orders } from '@/db/schema'

export const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
export const ORDER_TTL_MS = 15 * 60_000
/** How long after expiry a transfer sent in time can still be picked up. */
const USDT_GRACE_MS = 10 * 60_000
const USDT_STEP = 100
const KEY_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

type Order = typeof orders.$inferSelect

export function payMethods(config: Config): PayMethod[] {
  const methods: PayMethod[] = []
  if (
    config.APP_URL &&
    config.ALIPAY_APP_ID &&
    config.ALIPAY_PRIVATE_KEY &&
    config.ALIPAY_PUBLIC_KEY
  )
    methods.push('alipay')
  if (config.USDT_TRC20_ADDRESS && config.USDT_CNY_RATE) methods.push('usdt')
  // Free keys: never outside development, and only when asked for.
  if (config.SHOP_MOCK_PAY && config.NODE_ENV === 'development')
    methods.push('mock')
  return methods
}

const pem = (key: string, label: string) =>
  key.includes('BEGIN')
    ? key
    : `-----BEGIN ${label}-----\n${key}\n-----END ${label}-----`

function privateKey(key: string) {
  try {
    return createPrivateKey(pem(key, 'PRIVATE KEY'))
  } catch {
    return createPrivateKey(pem(key, 'RSA PRIVATE KEY'))
  }
}

/** Sorted `k=v&...` signing string; outgoing requests drop empty values. */
const canonical = (
  params: Record<string, string>,
  skip: string[],
  dropEmpty = false,
) =>
  Object.keys(params)
    .filter((k) => !skip.includes(k) && !(dropEmpty && params[k] === ''))
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')

/** Creates an Alipay QR trade and returns the QR link. */
export async function alipayPrecreate(
  config: Config,
  fetcher: typeof fetch,
  order: Pick<Order, 'orderNo' | 'amount' | 'productName'>,
): Promise<string> {
  const params: Record<string, string> = {
    app_id: config.ALIPAY_APP_ID ?? '',
    method: 'alipay.trade.precreate',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    // Alipay expects Beijing time.
    timestamp: new Date(Date.now() + 8 * 3_600_000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' '),
    version: '1.0',
    notify_url: new URL('/api/shop/payments/alipay/notify', config.APP_URL)
      .href,
    biz_content: JSON.stringify({
      out_trade_no: order.orderNo,
      total_amount: (order.amount / 100).toFixed(2),
      subject: order.productName,
      timeout_express: `${ORDER_TTL_MS / 60_000}m`,
    }),
  }
  params.sign = createSign('RSA-SHA256')
    .update(canonical(params, ['sign'], true))
    .sign(privateKey(config.ALIPAY_PRIVATE_KEY ?? ''), 'base64')
  const res = await fetcher(config.ALIPAY_GATEWAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams(params),
  })
  const body = (await res.json()) as {
    alipay_trade_precreate_response?: { code?: string; qr_code?: string }
  }
  const result = body.alipay_trade_precreate_response
  if (result?.code !== '10000' || !result.qr_code)
    throw new Error(`alipay precreate failed: ${result?.code ?? res.status}`)
  return result.qr_code
}

export function alipayVerify(config: Config, params: Record<string, string>) {
  if (!config.ALIPAY_PUBLIC_KEY || !params.sign) return false
  return createVerify('RSA-SHA256')
    .update(canonical(params, ['sign', 'sign_type']))
    .verify(
      createPublicKey(pem(config.ALIPAY_PUBLIC_KEY, 'PUBLIC KEY')),
      params.sign,
      'base64',
    )
}

/** Smallest free micro-USDT amount for a CNY-fen price among open orders. */
export function usdtAmount(taken: number[], fen: number, rate: number) {
  let amount = Math.ceil(fen / rate) * 10_000
  while (taken.includes(amount)) amount += USDT_STEP
  return amount
}

function keyCode() {
  const group = () =>
    Array.from({ length: 5 }, () => KEY_ALPHABET[randomInt(32)]).join('')
  return `CDK-${[group(), group(), group(), group()].join('-')}`
}

/** Marks a pending order paid and issues its keys; false when nothing changed. */
export function fulfilOrder(db: Db, orderId: number, tradeNo: string) {
  return db.transaction(
    (tx) => {
      const used = tx
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.tradeNo, tradeNo))
        .get()
      if (used) return false
      const order = tx
        .update(orders)
        .set({ status: 'paid', paidAt: new Date(), tradeNo })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')))
        .returning()
        .get()
      if (!order) return false
      tx.insert(cdkeys)
        .values(
          Array.from({ length: order.quantity }, () => ({
            code: keyCode(),
            balance: order.credits,
            orderId: order.id,
          })),
        )
        .run()
      return true
    },
    { behavior: 'immediate' },
  )
}

interface Trc20Transfer {
  transaction_id?: string
  to?: string
  type?: string
  value?: string
  block_timestamp?: number
  token_info?: { address?: string }
}

/** Settles pending USDT orders against confirmed transfers; returns the count. */
export async function syncUsdt(db: Db, config: Config, fetcher: typeof fetch) {
  const address = config.USDT_TRC20_ADDRESS
  if (!address) return 0
  const open = db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.method, 'usdt'),
        eq(orders.status, 'pending'),
        gt(orders.expiresAt, new Date(Date.now() - USDT_GRACE_MS)),
      ),
    )
    .all()
  if (!open.length) return 0
  const since = Math.min(...open.map((o) => o.createdAt.getTime()))
  const url = new URL(
    `/v1/accounts/${address}/transactions/trc20`,
    config.TRONGRID_URL,
  )
  url.search = new URLSearchParams({
    only_to: 'true',
    only_confirmed: 'true',
    limit: '200',
    contract_address: USDT_CONTRACT,
    min_timestamp: String(since),
  }).toString()
  const res = await fetcher(url, {
    headers: config.TRONGRID_API_KEY
      ? { 'TRON-PRO-API-KEY': config.TRONGRID_API_KEY }
      : {},
  })
  if (!res.ok) throw new Error(`trongrid responded ${res.status}`)
  const body = (await res.json()) as { data?: Trc20Transfer[] }
  let settled = 0
  for (const tx of body.data ?? []) {
    if (
      !tx.transaction_id ||
      tx.to !== address ||
      tx.type !== 'Transfer' ||
      tx.token_info?.address !== USDT_CONTRACT
    )
      continue
    const at = tx.block_timestamp ?? 0
    const order = open.find(
      (o) =>
        String(o.payAmount) === tx.value &&
        o.createdAt.getTime() <= at &&
        at <= o.expiresAt.getTime(),
    )
    if (order && fulfilOrder(db, order.id, tx.transaction_id)) settled++
  }
  return settled
}
