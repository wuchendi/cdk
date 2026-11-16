import type { ShopOrder } from '@cdk/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { routeTree } from '@/app/routeTree.gen'
import { browserOrders } from './browser-orders'
import '@/app/i18n'

const order: ShopOrder = {
  orderNo: '20261111ABCDEF',
  productName: '充值 CDK（1 额度）',
  credits: 1,
  quantity: 2,
  amount: 1600,
  method: 'alipay',
  status: 'pending',
  payAmount: 1600,
  payTarget: 'https://qr.alipay.com/test',
  createdAt: '2026-11-11T08:00:00Z',
  expiresAt: '2099-01-01T00:00:00Z',
  paidAt: null,
  keys: [],
}
const paid: ShopOrder = {
  ...order,
  status: 'paid',
  payTarget: null,
  keys: ['CDK-AAAAA-BBBBB-CCCCC-DDDDD', 'CDK-EEEEE-FFFFF-GGGGG-HHHHH'],
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
const catalog = {
  products: [
    {
      id: 1,
      name: '充值 CDK（1 额度）',
      description: '',
      credits: 1,
      price: 800,
      sold: 3,
    },
  ],
  methods: ['alipay', 'usdt'],
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('buys as a guest, pays and receives the keys', async () => {
  let created = false
  const fetcher = mount('/', (url, init) => {
    if (url === '/api/shop/catalog') return ok(catalog)
    if (init?.method === 'POST') {
      created = true
      return ok(order)
    }
    return created ? ok(paid) : fail(404, 'NOT_FOUND')
  })
  fireEvent.click(await screen.findByText('充值 CDK（1 额度）'))
  fireEvent.click(await screen.findByLabelText('增加数量'))
  expect(screen.getByText('¥16.00')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('联系邮箱'), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText('订单密码'), {
    target: { value: 'order-pass' },
  })
  fireEvent.click(screen.getByRole('button', { name: '立即购买' }))
  expect(
    await screen.findByText('CDK-AAAAA-BBBBB-CCCCC-DDDDD'),
  ).toBeInTheDocument()
  expect(screen.getByText('已支付')).toBeInTheDocument()
  const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST')
  expect(JSON.parse(String(post?.[1]?.body))).toEqual({
    productId: 1,
    quantity: 2,
    method: 'alipay',
    email: 'buyer@example.com',
    password: 'order-pass',
  })
  expect(browserOrders()).toEqual([order.orderNo])
})

it('shows USDT payment instructions for a pending order', async () => {
  mount(`/orders/${order.orderNo}`, () =>
    ok({ ...order, method: 'usdt', payAmount: 1_000_100, payTarget: 'TAddr' }),
  )
  expect(await screen.findByText('1.0001')).toBeInTheDocument()
  expect(screen.getByText('TAddr')).toBeInTheDocument()
  expect(screen.getByText('待支付')).toBeInTheDocument()
})

it('reports unknown orders', async () => {
  mount('/orders/gone', () => fail(404, 'NOT_FOUND'))
  expect(await screen.findByRole('alert')).toHaveTextContent('订单不存在')
})

it('looks up guest orders by email and order password', async () => {
  mount('/orders', (url, init) => {
    if (url !== '/api/shop/orders/lookup') return fail(404, 'NOT_FOUND')
    const body = JSON.parse(String(init?.body)) as { password: string }
    return ok(body.password === 'order-pass' ? [paid] : [])
  })
  expect(await screen.findByText('未找到浏览器订单记录')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: '订单密码查单' }))
  fireEvent.change(screen.getByLabelText('下单邮箱'), {
    target: { value: 'buyer@example.com' },
  })
  fireEvent.change(screen.getByLabelText('订单密码'), {
    target: { value: 'wrong-pass' },
  })
  fireEvent.click(screen.getByRole('button', { name: '查询' }))
  expect(await screen.findByText(/没有匹配的订单/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('订单密码'), {
    target: { value: 'order-pass' },
  })
  fireEvent.click(screen.getByRole('button', { name: '查询' }))
  expect(await screen.findByText(order.orderNo)).toBeInTheDocument()
})

it('settles a mock order from the payment page', async () => {
  const mock = { ...order, method: 'mock', payTarget: null }
  const fetcher = mount(`/orders/${order.orderNo}`, (url, init) => {
    if (url === '/api/shop/catalog')
      return ok({ ...catalog, testPayCode: false, turnstileSiteKey: null })
    return ok(init?.method === 'POST' ? { ...paid, method: 'mock' } : mock)
  })
  const button = await screen.findByRole('button', { name: '测试支付成功' })
  await waitFor(() => expect(button).toBeEnabled())
  expect(screen.queryByLabelText('测试码')).not.toBeInTheDocument()
  fireEvent.click(button)
  expect(
    await screen.findByText('CDK-AAAAA-BBBBB-CCCCC-DDDDD'),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '前往控制台使用' })).toHaveAttribute(
    'href',
    '/',
  )
  expect(fetcher).toHaveBeenCalledWith(
    `/api/shop/orders/${order.orderNo}/mock-pay`,
    expect.objectContaining({ method: 'POST' }),
  )
})

it('asks for the test code and a Turnstile token before paying', async () => {
  const mock = { ...order, method: 'mock', payTarget: null }
  const renderWidget = vi.fn(
    (
      _el: HTMLElement,
      options: { sitekey: string; callback: (t: string) => void },
    ) => {
      options.callback(`token-${renderWidget.mock.calls.length}`)
      return `widget-${renderWidget.mock.calls.length}`
    },
  )
  vi.stubGlobal('turnstile', { render: renderWidget, remove: vi.fn() })
  let attempts = 0
  const fetcher = mount(`/orders/${order.orderNo}`, (url, init) => {
    if (url === '/api/shop/catalog')
      return ok({ ...catalog, testPayCode: true, turnstileSiteKey: 'site-key' })
    if (init?.method === 'POST')
      return attempts++ === 0
        ? fail(403, 'INVALID_TEST_CODE')
        : ok({ ...paid, method: 'mock' })
    return ok(mock)
  })
  const button = await screen.findByRole('button', { name: '测试支付成功' })
  expect(button).toBeDisabled()
  await waitFor(() => expect(renderWidget).toHaveBeenCalled())
  expect(renderWidget.mock.calls[0]?.[1].sitekey).toBe('site-key')
  fireEvent.change(screen.getByLabelText('测试码'), {
    target: { value: 'wrong-code' },
  })
  expect(button).toBeEnabled()
  fireEvent.click(button)
  expect(await screen.findByRole('alert')).toHaveTextContent('测试码错误')
  await waitFor(() => expect(renderWidget).toHaveBeenCalledTimes(2))
  fireEvent.change(screen.getByLabelText('测试码'), {
    target: { value: 'test-code-123' },
  })
  fireEvent.click(screen.getByRole('button', { name: '测试支付成功' }))
  expect(
    await screen.findByText('CDK-AAAAA-BBBBB-CCCCC-DDDDD'),
  ).toBeInTheDocument()
  const posts = fetcher.mock.calls.filter(([, i]) => i?.method === 'POST')
  expect(JSON.parse(String(posts.at(-1)?.[1]?.body))).toEqual({
    code: 'test-code-123',
    turnstileToken: 'token-2',
  })
})
