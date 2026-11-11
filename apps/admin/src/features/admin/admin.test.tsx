import type { AdminOrder, AdminProduct, AdminTask } from '@cdk/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { routeTree } from '@/app/routeTree.gen'
import { setToken } from './token'
import '@/app/i18n'

const product: AdminProduct = {
  id: 1,
  name: '充值 CDK（1 额度）',
  description: '',
  credits: 1,
  price: 800,
  sold: 3,
  sort: 1,
  active: true,
}
const order: AdminOrder = {
  orderNo: '20261111ABCDEF',
  email: 'buyer@example.com',
  productName: '充值 CDK（1 额度）',
  credits: 1,
  quantity: 1,
  amount: 800,
  method: 'usdt',
  status: 'expired',
  payAmount: 1_110_000,
  payTarget: null,
  createdAt: '2026-11-11T08:00:00Z',
  expiresAt: '2026-11-11T08:15:00Z',
  paidAt: null,
  keys: [],
  tradeNo: null,
}
const task: AdminTask = {
  id: 7,
  cdkeyCode: 'KEY-1234',
  email: 'buyer@example.com',
  password: 'secretpw',
  totpSecret: 'JBSWY3DPEHPK3PXP',
  taskType: 'sub6',
  status: 'pending',
  message: null,
  createdAt: '2026-11-11T08:00:00Z',
  completedAt: null,
}
const ok = (data: unknown) => Response.json({ success: true, data })
const fail = (status: number, code: string) =>
  Response.json({ success: false, error: { code, message: code } }, { status })

function mount(
  path: string,
  handler: (url: string, init?: RequestInit) => Response,
) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) =>
    handler(url, init),
  )
  vi.stubGlobal('fetch', fetcher)
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <RouterProvider
        router={createRouter({
          routeTree,
          history: createMemoryHistory({ initialEntries: [path] }),
        })}
      />
    </QueryClientProvider>,
  )
  return fetcher
}
const bodyOf = (init?: RequestInit) =>
  JSON.parse(String(init?.body)) as Record<string, unknown>

afterEach(() => {
  vi.unstubAllGlobals()
  setToken(null)
})

it('signs in with the token, then unlists a product', async () => {
  let current = product
  const fetcher = mount('/', (url, init) => {
    if (new Headers(init?.headers).get('Authorization') !== 'Bearer secret')
      return fail(401, 'UNAUTHORIZED')
    if (url === '/api/admin/session') return ok({})
    if (init?.method === 'PATCH') {
      current = { ...current, ...bodyOf(init) }
      return ok(current)
    }
    return ok([current])
  })
  fireEvent.change(await screen.findByLabelText(/管理令牌/), {
    target: { value: 'wrong' },
  })
  fireEvent.click(screen.getByRole('button', { name: '进入后台' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('管理令牌无效')
  fireEvent.change(screen.getByLabelText(/管理令牌/), {
    target: { value: 'secret' },
  })
  fireEvent.click(screen.getByRole('button', { name: '进入后台' }))
  expect(await screen.findByText('已上架')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /^下架/ }))
  expect(await screen.findByText('已下架')).toBeInTheDocument()
  const patch = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')
  expect(patch?.[0]).toBe('/api/admin/products/1')
  expect(bodyOf(patch?.[1])).toEqual({ active: false })
})

it('creates a product with the price converted to fen', async () => {
  setToken('secret')
  const fetcher = mount('/', (_url, init) =>
    init?.method === 'POST' ? ok(product) : ok([]),
  )
  fireEvent.click(await screen.findByRole('button', { name: '新增商品' }))
  fireEvent.change(screen.getByLabelText('商品名称'), {
    target: { value: '五额度' },
  })
  fireEvent.change(screen.getByLabelText('每张卡密额度'), {
    target: { value: '5' },
  })
  fireEvent.change(screen.getByLabelText('价格（元）'), {
    target: { value: '39.9' },
  })
  fireEvent.click(screen.getByRole('button', { name: '保存' }))
  await waitFor(() =>
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      true,
    ),
  )
  const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(bodyOf(post?.[1])).toEqual({
    name: '五额度',
    description: '',
    credits: 5,
    price: 3990,
    sort: 0,
    active: true,
  })
})

it('settles an order by hand after confirmation', async () => {
  setToken('secret')
  let current = order
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
  const fetcher = mount('/orders', (_url, init) => {
    if (init?.method === 'POST') {
      current = {
        ...order,
        status: 'paid',
        keys: ['CDK-AAAAA-BBBBB-CCCCC-DDDDD'],
        tradeNo: `manual:${order.orderNo}`,
      }
      return ok(current)
    }
    return ok({ items: [current], total: 1, page: 1, pageSize: 20 })
  })
  expect(await screen.findByText('buyer@example.com')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '手动补单' }))
  expect(
    await screen.findByText('CDK-AAAAA-BBBBB-CCCCC-DDDDD'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '手动补单' })).toBeNull()
  expect(fetcher).toHaveBeenCalledWith(
    `/api/admin/orders/${order.orderNo}/settle`,
    expect.objectContaining({ method: 'POST' }),
  )
})

it('returns to sign-in when the token is rejected', async () => {
  setToken('stale')
  mount('/', () => fail(401, 'UNAUTHORIZED'))
  expect(await screen.findByLabelText(/管理令牌/)).toBeInTheDocument()
})

it('shows task credentials for the operator', async () => {
  setToken('secret')
  mount('/tasks', () => ok({ items: [task], total: 1, page: 1, pageSize: 20 }))
  expect(await screen.findByText('buyer@example.com')).toBeInTheDocument()
  expect(screen.getByText('secretpw')).toBeInTheDocument()
  expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
  expect(screen.getByText('KEY-1234')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '复制账号' })).toBeInTheDocument()
})
