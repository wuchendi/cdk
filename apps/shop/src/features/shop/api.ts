import type { PayMethod, ShopCatalog, ShopOrder } from '@cdk/shared'
import { apiFetch } from '@cdk/ui'

const post = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, {
    method: 'POST',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

export interface OrderInput {
  productId: number
  quantity: number
  method: PayMethod
  email: string
  password: string
}

export const shopApi = {
  catalog: () => apiFetch<ShopCatalog>('/shop/catalog'),
  createOrder: (input: OrderInput) => post<ShopOrder>('/shop/orders', input),
  order: (orderNo: string) =>
    apiFetch<ShopOrder>(`/shop/orders/${encodeURIComponent(orderNo)}`),
  mockPay: (
    orderNo: string,
    input: { code?: string; turnstileToken?: string } = {},
  ) =>
    post<ShopOrder>(
      `/shop/orders/${encodeURIComponent(orderNo)}/mock-pay`,
      input,
    ),
  lookup: (email: string, password: string) =>
    post<ShopOrder[]>('/shop/orders/lookup', { email, password }),
}

export const yuan = (fen: number) => `¥${(fen / 100).toFixed(2)}`
export const usdt = (micro: number) => (micro / 1_000_000).toFixed(4)
