import type { HealthStatus } from '@cdk/shared'
import { apiFetch } from '@cdk/ui'
import { useQuery } from '@tanstack/react-query'

export function useHealthQuery() {
  return useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => apiFetch<HealthStatus>('/health'),
    refetchInterval: 30_000,
  })
}
