import { randomBytes } from 'node:crypto'
import { ORDER_STATUSES, PAY_METHODS } from '@cdk/shared'
import { and, asc, desc, eq, gt, isNotNull } from 'drizzle-orm'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { validator } from 'hono-openapi'
import * as z from 'zod'
import { orders, products } from '@/db/schema'
import { AppError, NotFoundError } from '@/shared/lib/errors'
import { describeRoute, jsonOk } from '@/shared/lib/openapi'
import type { AppEnv } from '@/shared/lib/types'
import { presentOrders, soldByProduct } from './orders'
import {
  alipayPrecreate,
  alipayVerify,
  fulfilOrder,
  ORDER_TTL_MS,
  payMethods,
  usdtAmount,
} from './payments'

const LOOKUP_LIMIT = 10

const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase())
const orderPassword = z.string().min(6).max(128)
const orderInput = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20).default(1),
  method: z.enum(PAY_METHODS),
  email,
  password: orderPassword,
})
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string(),
  credits: z.number(),
  price: z.number(),
  sold: z.number(),
})
export const orderSchema = z.object({
  orderNo: z.string(),
  productName: z.string(),
  credits: z.number(),
  quantity: z.number(),
  amount: z.number(),
  method: z.enum(PAY_METHODS),
  status: z.enum(ORDER_STATUSES),
  payAmount: z.number(),
  payTarget: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  paidAt: z.string().nullable(),
  keys: z.array(z.string()),
})

export const validate = <T extends z.ZodType>(
  target: 'json' | 'param' | 'query',
  schema: T,
) =>
  validator(target, schema, (result) => {
    if (!result.success)
      throw new AppError(422, 'INVALID_INPUT', 'Invalid request input')
  })
const doc = (summary: string, schema: z.ZodType) =>
  describeRoute({ tags: ['Shop'], summary, responses: jsonOk(schema) })
const ok = <T>(c: Context, data: T) => {
  c.header('Cache-Control', 'no-store')
  return c.json({ success: true as const, data })
}

export function shopRoutes(fetcher: typeof fetch = fetch) {
  const router = new Hono<AppEnv>()

  router.get(
    '/shop/catalog',
    doc(
      'List products and available payment methods',
      z.object({
        products: z.array(productSchema),
        methods: z.array(z.enum(PAY_METHODS)),
      }),
    ),
    (c) => {
      const db = c.get('db')
      const sold = soldByProduct(db)
      const items = db
        .select()
        .from(products)
        .where(eq(products.active, true))
        .orderBy(asc(products.sort), asc(products.id))
        .all()
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          credits: p.credits,
          price: p.price,
          sold: sold.get(p.id) ?? 0,
        }))
      return c.json({
        success: true as const,
        data: { products: items, methods: payMethods(c.get('config')) },
      })
    },
  )

  router.post(
    '/shop/orders',
    doc('Create an order and start payment', orderSchema),
    validate('json', orderInput),
    async (c) => {
      const input = c.req.valid('json')
      const db = c.get('db')
      const config = c.get('config')
      const product = db
        .select()
        .from(products)
        .where(and(eq(products.id, input.productId), eq(products.active, true)))
        .get()
      if (!product) throw new NotFoundError('Product not found')
      if (!payMethods(config).includes(input.method))
        throw new AppError(
          409,
          'METHOD_UNAVAILABLE',
          'Payment method is not available',
        )
      const passwordHash = await Bun.password.hash(input.password)
      const amount = product.price * input.quantity
      const usdt = input.method === 'usdt'
      const order = db.transaction(
        (tx) => {
          const taken = usdt
            ? tx
                .select({ payAmount: orders.payAmount })
                .from(orders)
                .where(
                  and(
                    eq(orders.method, 'usdt'),
                    eq(orders.status, 'pending'),
                    gt(orders.expiresAt, new Date()),
                  ),
                )
                .all()
                .map((o) => o.payAmount)
            : []
          return tx
            .insert(orders)
            .values({
              orderNo:
                new Date().toISOString().slice(0, 10).replaceAll('-', '') +
                randomBytes(12).toString('hex').toUpperCase(),
              email: input.email,
              passwordHash,
              productId: product.id,
              productName: product.name,
              credits: product.credits,
              quantity: input.quantity,
              amount,
              method: input.method,
              payAmount: usdt
                ? usdtAmount(taken, amount, config.USDT_CNY_RATE ?? 1)
                : amount,
              payUrl: usdt ? config.USDT_TRC20_ADDRESS : null,
              expiresAt: new Date(Date.now() + ORDER_TTL_MS),
            })
            .returning()
            .get()
        },
        { behavior: 'immediate' },
      )
      if (input.method === 'alipay') {
        try {
          order.payUrl = await alipayPrecreate(config, fetcher, order)
        } catch (err) {
          db.delete(orders).where(eq(orders.id, order.id)).run()
          c.get('logger').error({ err }, 'alipay precreate failed')
          throw new AppError(
            502,
            'PAYMENT_UNAVAILABLE',
            'Payment could not be started',
          )
        }
        db.update(orders)
          .set({ payUrl: order.payUrl })
          .where(eq(orders.id, order.id))
          .run()
      }
      return ok(c, presentOrders(c.get('db'), [order])[0])
    },
  )
  router.post(
    '/shop/orders/lookup',
    doc('Find guest orders by email and order password', z.array(orderSchema)),
    validate('json', z.object({ email, password: orderPassword })),
    async (c) => {
      const input = c.req.valid('json')
      const rows = c
        .get('db')
        .select()
        .from(orders)
        .where(
          and(eq(orders.email, input.email), isNotNull(orders.passwordHash)),
        )
        .orderBy(desc(orders.id))
        .limit(LOOKUP_LIMIT)
        .all()
      const matches = []
      for (const row of rows)
        if (await Bun.password.verify(input.password, row.passwordHash ?? ''))
          matches.push(row)
      return ok(c, presentOrders(c.get('db'), matches))
    },
  )
  router.get(
    '/shop/orders/:orderNo',
    doc('Read an order by its number', orderSchema),
    validate('param', z.object({ orderNo: z.string().max(64) })),
    (c) => {
      const order = c
        .get('db')
        .select()
        .from(orders)
        .where(eq(orders.orderNo, c.req.valid('param').orderNo))
        .get()
      if (!order) throw new NotFoundError('Order not found')
      return ok(c, presentOrders(c.get('db'), [order])[0])
    },
  )

  router.post(
    '/shop/orders/:orderNo/mock-pay',
    doc('Settle a mock order (development only)', orderSchema),
    validate('param', z.object({ orderNo: z.string().max(64) })),
    (c) => {
      const db = c.get('db')
      const order = payMethods(c.get('config')).includes('mock')
        ? db
            .select()
            .from(orders)
            .where(
              and(
                eq(orders.orderNo, c.req.valid('param').orderNo),
                eq(orders.method, 'mock'),
              ),
            )
            .get()
        : undefined
      if (!order) throw new NotFoundError('Order not found')
      if (
        order.expiresAt.getTime() <= Date.now() ||
        !fulfilOrder(db, order.id, `mock:${order.orderNo}`)
      )
        throw new AppError(
          409,
          'ORDER_NOT_PENDING',
          'Order is not awaiting payment',
        )
      const paid = db.select().from(orders).where(eq(orders.id, order.id)).all()
      return ok(c, presentOrders(c.get('db'), paid)[0])
    },
  )

  router.post(
    '/shop/payments/alipay/notify',
    describeRoute({
      tags: ['Shop'],
      summary: 'Alipay asynchronous payment notification',
      responses: { 200: { description: 'Plain text `success`' } },
    }),
    async (c) => {
      const config = c.get('config')
      const params: Record<string, string> = {}
      for (const [key, value] of Object.entries(await c.req.parseBody()))
        if (typeof value === 'string') params[key] = value
      const db = c.get('db')
      const order =
        alipayVerify(config, params) && params.app_id === config.ALIPAY_APP_ID
          ? db
              .select()
              .from(orders)
              .where(
                and(
                  eq(orders.orderNo, params.out_trade_no ?? ''),
                  eq(orders.method, 'alipay'),
                ),
              )
              .get()
          : undefined
      if (
        !order ||
        !params.trade_no ||
        Math.round(Number(params.total_amount) * 100) !== order.amount
      ) {
        c.get('logger').warn(
          { orderNo: params.out_trade_no },
          'alipay notify rejected',
        )
        return c.text('fail', 400)
      }
      if (
        params.trade_status === 'TRADE_SUCCESS' ||
        params.trade_status === 'TRADE_FINISHED'
      )
        fulfilOrder(db, order.id, params.trade_no)
      return c.text('success')
    },
  )

  return router
}
