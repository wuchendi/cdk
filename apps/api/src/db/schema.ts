import { sql } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const createdAt = integer('created_at', { mode: 'timestamp' })
  .notNull()
  .default(sql`(unixepoch())`)

export const cdkeys = sqliteTable('cdkeys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),
  balance: real('balance').notNull().default(0),
  orderId: integer('order_id').references((): AnySQLiteColumn => orders.id),
  createdAt,
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cdkeyId: integer('cdkey_id')
    .notNull()
    .references(() => cdkeys.id),
  email: text('email').notNull(),
  password: text('password').notNull().default(''),
  totpSecret: text('totp_secret').notNull().default(''),
  taskType: text('task_type', {
    enum: ['sub6', 'sub12', 'sub24'],
  }).notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'success', 'failed'],
  })
    .notNull()
    .default('pending'),
  message: text('message'),
  createdAt,
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  credits: real('credits').notNull(),
  /** CNY fen. */
  price: integer('price').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  sort: integer('sort').notNull().default(0),
})

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNo: text('order_no').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  productName: text('product_name').notNull(),
  credits: real('credits').notNull(),
  quantity: integer('quantity').notNull(),
  /** CNY fen. */
  amount: integer('amount').notNull(),
  method: text('method', { enum: ['alipay', 'usdt', 'mock'] }).notNull(),
  /** Micro-USDT for usdt, CNY fen otherwise. */
  payAmount: integer('pay_amount').notNull(),
  payUrl: text('pay_url'),
  status: text('status', { enum: ['pending', 'paid'] })
    .notNull()
    .default('pending'),
  tradeNo: text('trade_no').unique(),
  createdAt,
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
})
