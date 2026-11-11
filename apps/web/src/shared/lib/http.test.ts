import { ApiError, apiFetch } from '@cdk/ui'
import { afterEach, describe, expect, it, vi } from 'vitest'

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('apiFetch', () => {
  it('unwraps the success envelope', async () => {
    mockFetch(200, {
      success: true,
      data: { ok: 1 },
    })
    await expect(apiFetch('/x')).resolves.toEqual({ ok: 1 })
    expect(fetch).toHaveBeenCalledWith('/api/x', expect.any(Object))
  })

  it('throws ApiError for the error envelope', async () => {
    mockFetch(404, {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    })
    await expect(apiFetch('/x')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('throws ApiError for a non-JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('oops', { status: 502 })),
    )
    await expect(apiFetch('/x')).rejects.toBeInstanceOf(ApiError)
  })
})
