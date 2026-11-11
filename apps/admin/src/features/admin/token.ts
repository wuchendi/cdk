import { useSyncExternalStore } from 'react'

const KEY = 'cdk.admin.token'
const listeners = new Set<() => void>()

export const getToken = () => sessionStorage.getItem(KEY)

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(KEY, token)
  else sessionStorage.removeItem(KEY)
  for (const listener of listeners) listener()
}

export function useToken() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }, getToken)
}
