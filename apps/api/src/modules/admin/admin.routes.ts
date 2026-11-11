import { createHash, timingSafeEqual } from 'node:crypto'
import { ORDER_STATUSES, TASK_STATUSES, TASK_TYPES } from '@cdk/shared'
import { and, asc, desc, eq, gt, like, lte, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import * as z from 'zod'
import { cdkeys, orders, products, tasks } from '@/db/schema'
import { presentOrders, soldByProduct } from '@/modules/shop/orders'
import { fulfilOrder } from '@/modules/shop/payments'
import {
  orderSchema,
  productSchema,
  validate,
} from '@/modules/shop/shop.routes'
import { AppError, NotFoundError } from '@/shared/lib/errors'
import { describeRoute, jsonOk } from '@/shared/lib/openapi'
import type { AppEnv } from '@/shared/lib/types'

const PAGE_SIZE = 20

const productFields = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
  credits: z.number().positive().max(100_000),
  /** CNY fen. */
  price: z.number().int().positive().max(100_000_000),
  sort: z.number().int().min(0).max(100_000),
  active: z.boolean(),
})
const productInput = productFields.extend({
  description: productFields.shape.description.default(''),
  sort: productFields.shape.sort.default(0),
  active: productFields.shape.active.default(true),
})
// Built from the default-free fields so a patch never resets omitted ones.
const productPatch = productFields
  .partial()
  .refine((patch) => Object.keys(patch).length > 0)
const adminProductSchema = productSchema.extend({
  active: z.boolean(),
  sort: z.number(),
})
const adminOrderSchema = orderSchema.extend({
  email: z.string(),
  tradeNo: z.string().nullable(),
})
const orderQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(254).default(''),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
})
const adminTaskSchema = z.object({
  id: z.number(),
  cdkeyCode: z.string(),
  email: z.string(),
  password: z.string(),
  totpSecret: z.string(),
  taskType: z.enum(TASK_TYPES),
  status: z.enum(TASK_STATUSES),
  message: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
})
const taskQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  search: z.string().trim().max(254).default(''),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
})
const taskPatch = z.object({
  status: z.enum(TASK_STATUSES),
  message: z.string().trim().max(500).optional(),
})
const idParam = z.object({ id: z.coerce.number().int().positive() })

const doc = (summary: string, schema: z.ZodType) =>
  describeRoute({
    tags: ['Admin'],
    summary,
    security: [{ admin: [] }],
    responses: jsonOk(schema),
  })
const digest = (value: string) => createHash('sha256').update(value).digest()

export function adminRoutes(token: string) {
  const router = new Hono<AppEnv>()
  const expected = digest(token)

  router.use('/admin/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const given = c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1]
    if (!given || !timingSafeEqual(digest(given), expected))
      throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin token')
    await next()
  })

  type Db = AppEnv['Variables']['db']
  const presentProducts = (db: Db, rows: (typeof products.$inferSelect)[]) => {
    const sold = soldByProduct(db)
    return rows.map((p) => ({ ...p, sold: sold.get(p.id) ?? 0 }))
  }
  const presentAdminOrders = (db: Db, rows: (typeof orders.$inferSelect)[]) =>
    presentOrders(db, rows).map((view, index) => ({
      ...view,
      email: rows[index]?.email ?? '',
      tradeNo: rows[index]?.tradeNo ?? null,
    }))

  router.get(
    '/admin/session',
    doc('Check the admin token', z.object({})),
    (c) => c.json({ success: true as const, data: {} }),
  )

  router.get(
    '/admin/products',
    doc('List all products', z.array(adminProductSchema)),
    (c) => {
      const db = c.get('db')
      const rows = db
        .select()
        .from(products)
        .orderBy(asc(products.sort), asc(products.id))
        .all()
      return c.json({ success: true as const, data: presentProducts(db, rows) })
    },
  )
  router.post(
    '/admin/products',
    doc('Create a product', adminProductSchema),
    validate('json', productInput),
    (c) => {
      const db = c.get('db')
      const row = db
        .insert(products)
        .values(c.req.valid('json'))
        .returning()
        .get()
      return c.json({
        success: true as const,
        data: presentProducts(db, [row])[0],
      })
    },
  )
  router.patch(
    '/admin/products/:id',
    doc('Edit, list or unlist a product', adminProductSchema),
    validate('param', idParam),
    validate('json', productPatch),
    (c) => {
      const db = c.get('db')
      const row = db
        .update(products)
        .set(c.req.valid('json'))
        .where(eq(products.id, c.req.valid('param').id))
        .returning()
        .get()
      if (!row) throw new NotFoundError('Product not found')
      return c.json({
        success: true as const,
        data: presentProducts(db, [row])[0],
      })
    },
  )

  router.get(
    '/admin/orders',
    doc(
      'List orders',
      z.object({
        items: z.array(adminOrderSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    ),
    validate('query', orderQuery),
    (c) => {
      const { status, search, page } = c.req.valid('query')
      const db = c.get('db')
      const now = new Date()
      const like = `%${search.replace(/[\\%_]/g, '\\$&')}%`
      const filter = and(
        status === 'paid' ? eq(orders.status, 'paid') : undefined,
        status === 'pending'
          ? and(eq(orders.status, 'pending'), gt(orders.expiresAt, now))
          : undefined,
        status === 'expired'
          ? and(eq(orders.status, 'pending'), lte(orders.expiresAt, now))
          : undefined,
        search
          ? or(
              sql`${orders.orderNo} like ${like} escape ${'\\'}`,
              sql`${orders.email} like ${like} escape ${'\\'}`,
            )
          : undefined,
      )
      const total =
        db
          .select({ count: sql<number>`count(*)` })
          .from(orders)
          .where(filter)
          .get()?.count ?? 0
      const rows = db
        .select()
        .from(orders)
        .where(filter)
        .orderBy(desc(orders.id))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)
        .all()
      return c.json({
        success: true as const,
        data: {
          items: presentAdminOrders(db, rows),
          total,
          page,
          pageSize: PAGE_SIZE,
        },
      })
    },
  )
  router.post(
    '/admin/orders/:orderNo/settle',
    doc('Settle an unpaid order by hand and issue its keys', adminOrderSchema),
    validate('param', z.object({ orderNo: z.string().max(64) })),
    (c) => {
      const db = c.get('db')
      const byNo = eq(orders.orderNo, c.req.valid('param').orderNo)
      const order = db.select().from(orders).where(byNo).get()
      if (!order) throw new NotFoundError('Order not found')
      if (!fulfilOrder(db, order.id, `manual:${order.orderNo}`))
        throw new AppError(409, 'ORDER_ALREADY_PAID', 'Order is already paid')
      c.get('logger').warn({ orderNo: order.orderNo }, 'order settled by hand')
      const rows = db.select().from(orders).where(byNo).all()
      return c.json({
        success: true as const,
        data: presentAdminOrders(db, rows)[0],
      })
    },
  )

  const taskColumns = {
    id: tasks.id,
    cdkeyCode: cdkeys.code,
    email: tasks.email,
    password: tasks.password,
    totpSecret: tasks.totpSecret,
    taskType: tasks.taskType,
    status: tasks.status,
    message: tasks.message,
    createdAt: tasks.createdAt,
    completedAt: tasks.completedAt,
  }
  type TaskRow = {
    id: number
    cdkeyCode: string
    email: string
    password: string
    totpSecret: string
    taskType: (typeof TASK_TYPES)[number]
    status: (typeof TASK_STATUSES)[number]
    message: string | null
    createdAt: Date
    completedAt: Date | null
  }
  const serializeTask = (row: TaskRow) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  })
  const taskById = (db: Db, id: number) =>
    db
      .select(taskColumns)
      .from(tasks)
      .innerJoin(cdkeys, eq(tasks.cdkeyId, cdkeys.id))
      .where(eq(tasks.id, id))
      .get()

  router.get(
    '/admin/tasks',
    doc(
      'List all tasks with their account credentials',
      z.object({
        items: z.array(adminTaskSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
      }),
    ),
    validate('query', taskQuery),
    (c) => {
      const { status, search, page } = c.req.valid('query')
      const db = c.get('db')
      const like_ = `%${search.replace(/[\\%_]/g, '\\$&')}%`
      const filter = and(
        status ? eq(tasks.status, status) : undefined,
        search
          ? or(
              sql`${tasks.email} like ${like_} escape ${'\\'}`,
              like(cdkeys.code, like_),
            )
          : undefined,
      )
      const total =
        db
          .select({ count: sql<number>`count(*)` })
          .from(tasks)
          .innerJoin(cdkeys, eq(tasks.cdkeyId, cdkeys.id))
          .where(filter)
          .get()?.count ?? 0
      const rows = db
        .select(taskColumns)
        .from(tasks)
        .innerJoin(cdkeys, eq(tasks.cdkeyId, cdkeys.id))
        .where(filter)
        .orderBy(desc(tasks.id))
        .limit(PAGE_SIZE)
        .offset((page - 1) * PAGE_SIZE)
        .all()
      return c.json({
        success: true as const,
        data: {
          items: rows.map(serializeTask),
          total,
          page,
          pageSize: PAGE_SIZE,
        },
      })
    },
  )
  router.patch(
    '/admin/tasks/:id',
    doc('Update a task status and run note', adminTaskSchema),
    validate('param', idParam),
    validate('json', taskPatch),
    (c) => {
      const { id } = c.req.valid('param')
      const { status, message } = c.req.valid('json')
      const db = c.get('db')
      const done = status === 'success' || status === 'failed'
      const updated = db
        .update(tasks)
        .set({
          status,
          ...(message !== undefined ? { message } : {}),
          completedAt: done ? new Date() : null,
        })
        .where(eq(tasks.id, id))
        .returning({ id: tasks.id })
        .get()
      if (!updated) throw new NotFoundError('Task not found')
      c.get('logger').warn({ taskId: id, status }, 'task updated by admin')
      const row = taskById(db, id)
      if (!row) throw new NotFoundError('Task not found')
      return c.json({ success: true as const, data: serializeTask(row) })
    },
  )

  return router
}
