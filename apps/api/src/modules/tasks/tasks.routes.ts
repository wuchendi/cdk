import {
  CREDENTIAL_SEPARATOR,
  TASK_COST,
  TASK_STATUSES,
  TASK_TYPES,
} from '@cdk/shared'
import { and, desc, eq, inArray, notExists, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { validator } from 'hono-openapi'
import * as z from 'zod'
import { cdkeys, tasks } from '@/db/schema'
import { AppError } from '@/shared/lib/errors'
import { describeRoute, jsonOk, resolver } from '@/shared/lib/openapi'
import type { AppEnv } from '@/shared/lib/types'

const taskSchema = z.object({
  id: z.number(),
  email: z.string(),
  taskType: z.enum(TASK_TYPES),
  status: z.enum(TASK_STATUSES),
  message: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
})
const sessionSchema = z.object({ balance: z.number() })
const statsSchema = z.object({
  total: z.number(),
  pending: z.number(),
  running: z.number(),
  success: z.number(),
  failed: z.number(),
})
const TOTP_SECRET_RE = /^[A-Z2-7]{16,64}$/
/** `email----password----2FA` parsed into its fields, or a 422 on any mismatch. */
const credentialSchema = z
  .string()
  .max(400)
  .transform((raw, ctx) => {
    const parts = raw.split(CREDENTIAL_SEPARATOR)
    const invalid = () => {
      ctx.addIssue({ code: 'custom', message: 'Invalid credential format' })
      return z.NEVER
    }
    const [emailRaw, passwordRaw, totpRaw] = parts
    if (
      parts.length !== 3 ||
      emailRaw === undefined ||
      passwordRaw === undefined ||
      totpRaw === undefined
    )
      return invalid()
    const email = emailRaw.trim().toLowerCase()
    const password = passwordRaw.trim()
    const totpSecret = totpRaw.replace(/\s+/g, '').toUpperCase()
    if (
      !z.email().max(254).safeParse(email).success ||
      password.length < 1 ||
      password.length > 128 ||
      !TOTP_SECRET_RE.test(totpSecret)
    )
      return invalid()
    return { email, password, totpSecret }
  })
const inputSchema = z.object({
  credential: credentialSchema,
  taskType: z.enum(TASK_TYPES),
})
const querySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  search: z.string().max(254).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1),
})
const errorSchema = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
})
const errors = Object.fromEntries(
  [401, 404, 409, 422].map((status) => [
    status,
    {
      description: 'Request rejected',
      content: { 'application/json': { schema: resolver(errorSchema) } },
    },
  ]),
)
const validate = <T extends z.ZodType>(
  target: 'json' | 'query' | 'param',
  schema: T,
) =>
  validator(target, schema, (result) => {
    if (!result.success)
      throw new AppError(422, 'INVALID_INPUT', 'Invalid request input')
  })
const doc = (summary: string, schema: z.ZodType) =>
  describeRoute({
    tags: ['Tasks'],
    summary,
    security: [{ cdkey: [] }],
    responses: { ...jsonOk(schema), ...errors },
  })
const serialize = (task: typeof tasks.$inferSelect) => ({
  id: task.id,
  email: task.email,
  taskType: task.taskType,
  status: task.status,
  message: task.message,
  createdAt: task.createdAt.toISOString(),
  completedAt: task.completedAt?.toISOString() ?? null,
})

export function taskRoutes() {
  type Env = AppEnv & { Variables: { keyId: number } }
  const router = new Hono<Env>()
  const auth = createMiddleware<Env>(async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const code = c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1]
    const key = code
      ? await c
          .get('db')
          .select({ id: cdkeys.id })
          .from(cdkeys)
          .where(eq(cdkeys.code, code))
          .get()
      : undefined
    if (!key) throw new AppError(401, 'INVALID_KEY', 'Invalid access key')
    c.set('keyId', key.id)
    await next()
  })
  router.use('/session', auth)
  router.use('/tasks', auth)
  router.use('/tasks/*', auth)
  router.get(
    '/session',
    doc('Validate key and read balance', sessionSchema),
    async (c) => {
      const key = await c
        .get('db')
        .select({ balance: cdkeys.balance })
        .from(cdkeys)
        .where(eq(cdkeys.id, c.get('keyId')))
        .get()
      return c.json({ success: true as const, data: key })
    },
  )
  router.get(
    '/tasks',
    doc(
      'List owned tasks',
      z.object({
        items: z.array(taskSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number(),
        stats: statsSchema,
      }),
    ),
    validate('query', querySchema),
    async (c) => {
      const { status, search, page } = c.req.valid('query')
      const db = c.get('db')
      const own = eq(tasks.cdkeyId, c.get('keyId'))
      const filter = and(
        own,
        status ? eq(tasks.status, status) : undefined,
        search
          ? sql`${tasks.email} like ${`%${search.replace(/[\\%_]/g, '\\$&')}%`} escape ${'\\'}`
          : undefined,
      )
      const stats = { total: 0, pending: 0, running: 0, success: 0, failed: 0 }
      for (const row of await db
        .select({ status: tasks.status, count: sql<number>`count(*)` })
        .from(tasks)
        .where(own)
        .groupBy(tasks.status)
        .all()) {
        stats[row.status] = row.count
        stats.total += row.count
      }
      const total =
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(tasks)
            .where(filter)
            .get()
        )?.count ?? 0
      const rows = await db
        .select()
        .from(tasks)
        .where(filter)
        .orderBy(desc(tasks.id))
        .limit(10)
        .offset((page - 1) * 10)
        .all()
      const items = rows.map(serialize)
      return c.json({
        success: true as const,
        data: { items, total, page, pageSize: 10, stats },
      })
    },
  )
  router.post(
    '/tasks',
    doc('Submit task and debit credits', taskSchema),
    validate('json', inputSchema),
    async (c) => {
      const { credential, taskType } = c.req.valid('json')
      const db = c.get('db')
      const keyId = c.get('keyId')
      const cost = TASK_COST[taskType]
      const duplicate = db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.cdkeyId, keyId),
            eq(tasks.email, credential.email),
            eq(tasks.taskType, taskType),
            inArray(tasks.status, ['pending', 'running']),
          ),
        )
      const [, inserted] = await db.batch([
        db
          .update(cdkeys)
          .set({ balance: sql`${cdkeys.balance} - ${cost}` })
          .where(
            and(
              eq(cdkeys.id, keyId),
              sql`${cdkeys.balance} >= ${cost}`,
              notExists(duplicate),
            ),
          ),
        // Inserts only when the debit above went through.
        db
          .insert(tasks)
          .select(
            sql`select null, ${keyId}, ${credential.email},
              ${credential.password}, ${credential.totpSecret}, ${taskType},
              'pending', 'Awaiting execution service', unixepoch(), null
              where changes() = 1`,
          )
          .returning(),
      ])
      const task = inserted[0]
      if (!task) {
        if (await duplicate.get())
          throw new AppError(
            409,
            'DUPLICATE_TASK',
            'This task is already queued or running',
          )
        throw new AppError(409, 'INSUFFICIENT_BALANCE', 'Insufficient credits')
      }
      return c.json({ success: true as const, data: serialize(task) })
    },
  )
  router.delete(
    '/tasks/:id',
    doc(
      'Cancel pending task and refund credits',
      z.object({ refunded: z.number() }),
    ),
    validate('param', z.object({ id: z.coerce.number().int().positive() })),
    async (c) => {
      const { id } = c.req.valid('param')
      const db = c.get('db')
      const own = and(eq(tasks.id, id), eq(tasks.cdkeyId, c.get('keyId')))
      const task = await db.select().from(tasks).where(own).get()
      if (!task) throw new AppError(404, 'NOT_FOUND', 'Task not found')
      const notPending = new AppError(
        409,
        'TASK_NOT_PENDING',
        'Only pending tasks can be cancelled',
      )
      if (task.status !== 'pending') throw notPending
      const cost = TASK_COST[task.taskType]
      const [deleted] = await db.batch([
        db
          .delete(tasks)
          .where(and(own, eq(tasks.status, 'pending')))
          .returning({ id: tasks.id }),
        // Refunds only when the delete above removed the task.
        db
          .update(cdkeys)
          .set({ balance: sql`${cdkeys.balance} + ${cost}` })
          .where(and(eq(cdkeys.id, task.cdkeyId), sql`changes() = 1`)),
      ])
      if (!deleted.length) throw notPending
      return c.json({ success: true as const, data: { refunded: cost } })
    },
  )
  return router
}
