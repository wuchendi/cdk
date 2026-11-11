/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin; empty means same origin. */
  readonly VITE_API_URL?: string
  readonly VITE_DASHBOARD_URL?: string
}
