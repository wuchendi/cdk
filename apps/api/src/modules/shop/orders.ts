import { eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import { cdkeys, orders } from '@/db/schema'

type Order = typeof orders.$inferSelect

export function orderStatus(order: Pick<Order, 'status' | 'expiresAt'>) {
  if (order.status === 'paid') return 'paid' as const
  return order.expiresAt.getTime() <= Date.now()
    ? ('expired' as const)
    : ('pending' as const)
}

/** Buyer-facing view of orders, with the keys of paid ones. */
export async function presentOrders(db: Db, rows: Order[]) {
  const paid = rows.filter((o) => o.status === 'paid').map((o) => o.id)
  const keys = paid.length
    ? await db
        .select({ orderId: cdkeys.orderId, code: cdkeys.code })
        .from(cdkeys)
        .where(inArray(cdkeys.orderId, paid))
        .all()
    : []
  return rows.map((o) => {
    const status = orderStatus(o)
    return {
      orderNo: o.orderNo,
      productName: o.productName,
      credits: o.credits,
      quantity: o.quantity,
      amount: o.amount,
      method: o.method,
      status,
      payAmount: o.payAmount,
      payTarget: status === 'pending' ? o.payUrl : null,
      createdAt: o.createdAt.toISOString(),
      expiresAt: o.expiresAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      keys: keys.filter((k) => k.orderId === o.id).map((k) => k.code),
    }
  })
}

/** Units sold per product id, counting paid orders only. */
export async function soldByProduct(db: Db) {
  const rows = await db
    .select({
      productId: orders.productId,
      sold: sql<number>`sum(${orders.quantity})`,
    })
    .from(orders)
    .where(eq(orders.status, 'paid'))
    .groupBy(orders.productId)
    .all()
  return new Map(rows.map((row) => [row.productId, row.sold]))
}
