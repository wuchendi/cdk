export const TASK_STATUSES = [
  'pending',
  'running',
  'success',
  'failed',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** Separator for the `email----password----2FA` task credential field. */
export const CREDENTIAL_SEPARATOR = '----'

export const TASK_TYPES = ['sub6', 'sub12', 'sub24'] as const
export type TaskType = (typeof TASK_TYPES)[number]

/** Credits charged per task type. */
export const TASK_COST: Record<TaskType, number> = {
  sub6: 1,
  sub12: 1.5,
  sub24: 2,
}

export interface HealthStatus {
  status: 'ok'
  version: string
  uptime: number
}

export interface DashboardTask {
  id: number
  email: string
  taskType: TaskType
  status: TaskStatus
  message: string | null
  createdAt: string
  completedAt: string | null
}

export interface TaskList {
  items: DashboardTask[]
  total: number
  page: number
  pageSize: number
  stats: Record<TaskStatus | 'total', number>
}

/** `mock` settles without money and exists only in development. */
export const PAY_METHODS = ['alipay', 'usdt', 'mock'] as const
export type PayMethod = (typeof PAY_METHODS)[number]

export const ORDER_STATUSES = ['pending', 'paid', 'expired'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface ShopProduct {
  id: number
  name: string
  description: string
  credits: number
  /** CNY fen. */
  price: number
  sold: number
}

export interface ShopCatalog {
  products: ShopProduct[]
  methods: PayMethod[]
}

export interface ShopOrder {
  orderNo: string
  productName: string
  credits: number
  quantity: number
  /** CNY fen. */
  amount: number
  method: PayMethod
  status: OrderStatus
  /** Amount to pay: micro-USDT for usdt, CNY fen otherwise. */
  payAmount: number
  /** Alipay QR link or USDT receiving address; null for mock or unless pending. */
  payTarget: string | null
  createdAt: string
  expiresAt: string
  paidAt: string | null
  keys: string[]
}

export interface AdminProduct extends ShopProduct {
  active: boolean
  sort: number
}

export interface AdminOrder extends ShopOrder {
  email: string
  /** Provider trade number, chain transaction id, or a mock/manual marker. */
  tradeNo: string | null
}

export interface AdminOrderList {
  items: AdminOrder[]
  total: number
  page: number
  pageSize: number
}

export interface AdminTask {
  id: number
  cdkeyCode: string
  email: string
  password: string
  totpSecret: string
  taskType: TaskType
  status: TaskStatus
  message: string | null
  createdAt: string
  completedAt: string | null
}

export interface AdminTaskList {
  items: AdminTask[]
  total: number
  page: number
  pageSize: number
}
