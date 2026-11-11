import type { AdminTask, TaskStatus } from '@cdk/shared'
import { TASK_STATUSES } from '@cdk/shared'
import {
  Badge,
  Button,
  DataTable,
  Input,
  PageTitle,
  Pagination,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
} from '@cdk/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi, useErrorText } from './api'

const STATUS_VARIANT: Record<TaskStatus, 'secondary' | 'default' | 'outline'> =
  {
    pending: 'secondary',
    running: 'outline',
    success: 'default',
    failed: 'outline',
  }
const COLUMNS = [
  'id',
  'cdkey',
  'account',
  'type',
  'status',
  'message',
  'createdAt',
  'actions',
] as const

function Copy({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="font-mono text-xs break-all text-left hover:text-primary"
      title={t('tasks.copy')}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      <span className="text-muted-foreground">{label}</span>
      {copied ? t('tasks.copied') : value}
    </button>
  )
}

export function Tasks() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const client = useQueryClient()
  const [status, setStatus] = useState<TaskStatus>()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const list = useQuery({
    queryKey: ['admin', 'tasks', status, search, page],
    queryFn: () => adminApi.tasks({ status, search, page }),
    retry: false,
  })
  const update = useMutation({
    mutationFn: ({ task, next }: { task: AdminTask; next: TaskStatus }) => {
      const message =
        next === 'success' || next === 'failed'
          ? (window.prompt(t('tasks.notePrompt'), task.message ?? '') ??
            undefined)
          : undefined
      return adminApi.updateTask(task.id, next, message)
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'tasks'] }),
  })
  const error = list.error ?? update.error
  const pages = Math.max(
    1,
    Math.ceil((list.data?.total ?? 0) / (list.data?.pageSize ?? 1)),
  )
  const pick = (next?: TaskStatus) => {
    setStatus(next)
    setPage(1)
  }
  return (
    <>
      <PageTitle>{t('tasks.title')}</PageTitle>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { value: '', label: t('tasks.all') },
            ...TASK_STATUSES.map((item) => ({
              value: item,
              label: t(`tasks.status.${item}`),
            })),
          ]}
          value={status ?? ''}
          onChange={(next) => pick((next || undefined) as TaskStatus)}
        />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(draft.trim())
            setPage(1)
          }}
        >
          <Input
            aria-label={t('tasks.search')}
            placeholder={t('tasks.search')}
            className="w-64"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="outline">
            {t('tasks.searchSubmit')}
          </Button>
        </form>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {errorText(error)}
        </p>
      )}
      <DataTable
        className="[&_tr]:align-top"
        columns={COLUMNS.map((column) => t(`tasks.columns.${column}`))}
        message={
          list.isPending
            ? t('tasks.loading')
            : list.data?.items.length === 0
              ? t('tasks.empty')
              : undefined
        }
      >
        {list.data?.items.map((task) => (
          <tr key={task.id}>
            <td className="tabular-nums">{task.id}</td>
            <td className="font-mono text-xs whitespace-nowrap">
              {task.cdkeyCode}
            </td>
            <td>
              <div className="flex max-w-80 flex-col gap-1">
                <Copy value={task.email} label="" />
                <Copy
                  value={task.password}
                  label={`${t('tasks.password')}: `}
                />
                <Copy value={task.totpSecret} label={`${t('tasks.totp')}: `} />
                <Button
                  variant="outline"
                  size="xs"
                  className="w-fit"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      `${task.email}----${task.password}----${task.totpSecret}`,
                    )
                  }
                >
                  {t('tasks.copyAll')}
                </Button>
              </div>
            </td>
            <td className="whitespace-nowrap">
              {t(`tasks.types.${task.taskType}`)}
            </td>
            <td>
              <Badge variant={STATUS_VARIANT[task.status]}>
                {t(`tasks.status.${task.status}`)}
              </Badge>
            </td>
            <td className="max-w-64 break-words text-muted-foreground">
              {task.message ?? '—'}
            </td>
            <td className="whitespace-nowrap">
              {new Date(task.createdAt).toLocaleString('zh-CN')}
              {task.completedAt && (
                <span className="block text-xs text-muted-foreground">
                  {t('tasks.completedAt')}:{' '}
                  {new Date(task.completedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </td>
            <td>
              <Select
                value={task.status}
                onValueChange={(next) =>
                  next &&
                  next !== task.status &&
                  update.mutate({ task, next: next as TaskStatus })
                }
                disabled={update.isPending}
              >
                <SelectTrigger
                  className="w-28"
                  aria-label={`${t('tasks.setStatus')} ${task.email}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`tasks.status.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination
        summary={t('tasks.pagination', {
          page,
          pages,
          count: list.data?.total ?? 0,
        })}
        previous={t('tasks.previous')}
        next={t('tasks.next')}
        page={page}
        pages={pages}
        onChange={setPage}
      />
    </>
  )
}
