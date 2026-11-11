import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiStatus } from './api-status'
import '@/app/i18n'

function renderStatus() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={client}>
      <ApiStatus />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('apiStatus', () => {
  it('shows the version when the API is healthy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          data: { status: 'ok', version: '1.2.3', uptime: 1 },
        }),
      ),
    )
    renderStatus()
    expect(await screen.findByText('在线 v1.2.3')).toBeInTheDocument()
  })

  it('shows offline when the API fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            success: false,
            error: { code: 'X', message: 'x' },
          },
          { status: 500 },
        ),
      ),
    )
    renderStatus()
    expect(await screen.findByText('离线')).toBeInTheDocument()
  })
})
