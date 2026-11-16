import type { Config } from '@/config'
import type { Logger } from '@/logger'

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const SITEVERIFY_TIMEOUT_MS = 5000

/** The public site key when Turnstile is on (site key and secret both set). */
export const turnstileSiteKey = (config: Config) =>
  config.TURNSTILE_SITE_KEY && config.TURNSTILE_SECRET_KEY
    ? config.TURNSTILE_SITE_KEY
    : null

/** True when Turnstile is off; otherwise the token must pass siteverify (fails closed). */
export async function verifyTurnstile(
  config: Config,
  fetcher: typeof fetch,
  logger: Logger,
  token: string | undefined,
  ip: string | undefined,
) {
  if (!turnstileSiteKey(config)) return true
  if (!token) return false
  const body = new URLSearchParams({
    secret: config.TURNSTILE_SECRET_KEY ?? '',
    response: token,
  })
  if (ip) body.set('remoteip', ip)
  try {
    const res = await fetcher(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    })
    if (!res.ok) {
      logger.warn({ status: res.status }, 'turnstile siteverify failed')
      return false
    }
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    logger.warn({ err }, 'turnstile siteverify failed')
    return false
  }
}
