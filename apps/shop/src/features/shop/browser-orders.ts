const ORDERS_KEY = 'cdk.shop.orders'

/** Order numbers placed from this browser, newest first. */
export function browserOrders(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]')
    return Array.isArray(value)
      ? value.filter((v) => typeof v === 'string')
      : []
  } catch {
    return []
  }
}

export function rememberOrder(orderNo: string) {
  const next = [orderNo, ...browserOrders().filter((no) => no !== orderNo)]
  localStorage.setItem(ORDERS_KEY, JSON.stringify(next.slice(0, 20)))
}
