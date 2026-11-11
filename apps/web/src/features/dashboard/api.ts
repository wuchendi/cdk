import type { TaskList, TaskType } from '@cdk/shared'
import { apiFetch } from '@cdk/ui'

export function dashboardApi(key: string) {
  const headers = { Authorization: `Bearer ${key}` }
  return {
    session: () => apiFetch<{ balance: number }>('/session', { headers }),
    list: (params: URLSearchParams) =>
      apiFetch<TaskList>(`/tasks?${params}`, { headers }),
    submit: (credential: string, taskType: TaskType) =>
      apiFetch('/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ credential, taskType }),
      }),
    cancel: (id: number) =>
      apiFetch(`/tasks/${id}`, { method: 'DELETE', headers }),
  }
}
