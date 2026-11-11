import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Dashboard } from './dashboard'
import '@/app/i18n'

afterEach(() => vi.unstubAllGlobals())
it('activates a key, submits and cancels a task, searches, filters and logs out', async () => {
  let exists = false
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/session')
      return Response.json({ success: true, data: { balance: 3 } })
    if (init?.method === 'POST') {
      exists = true
      return Response.json({ success: true, data: { id: 1 } })
    }
    if (init?.method === 'DELETE') {
      exists = false
      return Response.json({ success: true, data: { refunded: 1 } })
    }
    return Response.json({
      success: true,
      data: {
        items: exists
          ? [
              {
                id: 1,
                email: 'a@example.com',
                taskType: 'sub6',
                status: 'pending',
                message: null,
                createdAt: '2026-11-11T08:00:00Z',
                completedAt: null,
              },
            ]
          : [],
        total: exists ? 1 : 0,
        page: 1,
        pageSize: 10,
        stats: {
          total: exists ? 1 : 0,
          pending: exists ? 1 : 0,
          running: 0,
          success: 0,
          failed: 0,
        },
      },
    })
  })
  vi.stubGlobal('fetch', fetcher)
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Dashboard />
    </QueryClientProvider>,
  )
  fireEvent.change(screen.getByLabelText('卡密'), {
    target: { value: 'alpha' },
  })
  fireEvent.click(screen.getByRole('button', { name: '激活' }))
  expect(await screen.findByText('可用额度：3')).toBeInTheDocument()
  expect(screen.getByLabelText('任务类型')).toHaveTextContent(
    '6 个月订阅 · 1 额度',
  )
  fireEvent.change(screen.getByLabelText(/账号信息/), {
    target: { value: 'a@example.com----pw----JBSWY3DPEHPK3PXP' },
  })
  fireEvent.click(screen.getByRole('button', { name: '提交任务' }))
  expect(
    await screen.findByRole('cell', { name: 'a@example.com' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '取消并退款' }))
  await waitFor(() =>
    expect(
      screen.queryByRole('cell', { name: 'a@example.com' }),
    ).not.toBeInTheDocument(),
  )
  fireEvent.change(screen.getByLabelText('搜索邮箱'), {
    target: { value: 'find' },
  })
  fireEvent.click(screen.getByRole('tab', { name: '运行成功' }))
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url]) =>
          url.includes('status=success') && url.includes('search=find'),
      ),
    ).toBe(true),
  )
  fireEvent.click(screen.getByRole('button', { name: '退出' }))
  expect(await screen.findByText('请先激活卡密查看任务')).toBeInTheDocument()
})
it('shows activation errors and allows notice dismissal and purchase feedback', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        {
          success: false,
          error: { code: 'INVALID_KEY', message: 'Invalid access key' },
        },
        { status: 401 },
      ),
    ),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Dashboard />
    </QueryClientProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: '关闭使用说明' }))
  expect(screen.queryByText('使用说明')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '购买Key' }))
  expect(
    screen.getByText('购买渠道暂未配置，请联系管理员。'),
  ).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('卡密'), { target: { value: 'bad' } })
  fireEvent.click(screen.getByRole('button', { name: '激活' }))
  expect(
    await screen.findByText('卡密无效，请检查后重试。'),
  ).toBeInTheDocument()
})

it('links the purchase button to the shop when one is configured', () => {
  vi.stubEnv('VITE_SHOP_URL', 'https://shop.example.com')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ success: true, data: {} })),
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Dashboard />
    </QueryClientProvider>,
  )
  expect(screen.getByRole('link', { name: '购买Key' })).toHaveAttribute(
    'href',
    'https://shop.example.com',
  )
  vi.unstubAllEnvs()
})
