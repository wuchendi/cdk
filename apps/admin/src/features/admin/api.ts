import type {
  AdminOrder,
  AdminOrderList,
  AdminProduct,
  AdminTask,
  AdminTaskList,
  OrderStatus,
  TaskStatus,
} from '@cdk/shared'
import { ApiError, apiFetch } from '@cdk/ui'
import { useTranslation } from 'react-i18next'
import { getToken, setToken } from './token'

/** Admin request; a rejected token signs the operator out. */
async function request<T>(path: string, method = 'GET', body?: unknown) {
  try {
    return await apiFetch<T>(`/admin${path}`, {
      method,
      headers: { Authorization: `Bearer ${getToken() ?? ''}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) setToken(null)
    throw error
  }
}

export interface ProductInput {
  name: string
  description: string
  credits: number
  /** CNY fen. */
  price: number
  sort: number
  active: boolean
}

export const adminApi = {
  check: (token: string) =>
    apiFetch('/admin/session', {
      headers: { Authorization: `Bearer ${token}` },
    }),
  products: () => request<AdminProduct[]>('/products'),
  createProduct: (input: ProductInput) =>
    request<AdminProduct>('/products', 'POST', input),
  updateProduct: (id: number, patch: Partial<ProductInput>) =>
    request<AdminProduct>(`/products/${id}`, 'PATCH', patch),
  orders: (query: { status?: OrderStatus; search: string; page: number }) => {
    const params = new URLSearchParams({
      page: String(query.page),
      search: query.search,
    })
    if (query.status) params.set('status', query.status)
    return request<AdminOrderList>(`/orders?${params}`)
  },
  settle: (orderNo: string) =>
    request<AdminOrder>(
      `/orders/${encodeURIComponent(orderNo)}/settle`,
      'POST',
    ),
  tasks: (query: { status?: TaskStatus; search: string; page: number }) => {
    const params = new URLSearchParams({
      page: String(query.page),
      search: query.search,
    })
    if (query.status) params.set('status', query.status)
    return request<AdminTaskList>(`/tasks?${params}`)
  },
  updateTask: (id: number, status: TaskStatus, message?: string) =>
    request<AdminTask>(`/tasks/${id}`, 'PATCH', { status, message }),
}

export const yuan = (fen: number) => `¥${(fen / 100).toFixed(2)}`

export function useErrorText() {
  const { t } = useTranslation()
  return (error: Error) =>
    t(`errors.${error instanceof ApiError ? error.code : 'NETWORK'}`, {
      defaultValue: t('errors.NETWORK'),
    })
}
