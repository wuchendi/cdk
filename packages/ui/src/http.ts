export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

const base = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/api`

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = (await res.json().catch(() => null)) as Envelope<T> | null
  if (!body)
    throw new ApiError(
      res.status,
      'BAD_RESPONSE',
      `Unexpected response (${res.status})`,
    )
  if (!body.success)
    throw new ApiError(res.status, body.error.code, body.error.message)
  return body.data
}
