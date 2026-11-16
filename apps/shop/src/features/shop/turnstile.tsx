import { useEffect, useRef } from 'react'

interface TurnstileApi {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string
      theme: 'light'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptPromise: Promise<void> | null = null

/** Loads the Turnstile script once per page; a failed load is retried on the next mount. */
function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new Error('Turnstile script failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Cloudflare Turnstile widget. Reports the token through `onToken` (null when
 * it expires or errors). Tokens are single-use: bump `resetKey` after a failed
 * submit to render a fresh widget.
 */
export function Turnstile({
  siteKey,
  onToken,
  resetKey,
}: {
  siteKey: string
  onToken: (token: string | null) => void
  resetKey?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey only triggers a fresh widget
  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false
    onTokenRef.current(null)
    loadTurnstile()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return
        widgetId = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (widgetId !== undefined) window.turnstile?.remove(widgetId)
    }
  }, [siteKey, resetKey])

  return <div ref={ref} />
}
