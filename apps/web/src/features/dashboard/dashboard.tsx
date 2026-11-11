import type { TaskStatus, TaskType } from '@cdk/shared'
import { TASK_COST, TASK_STATUSES, TASK_TYPES } from '@cdk/shared'
import {
  ApiError,
  AppShell,
  Button,
  DataTable,
  Field,
  Input,
  Label,
  Notice,
  PageTitle,
  Pagination,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
} from '@cdk/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, KeyRound, RefreshCw, ShoppingCart, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from './api'

export function Dashboard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [key, setKey] = useState('')
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState(true)
  const [purchase, setPurchase] = useState(false)
  const [credential, setCredential] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('sub6')
  const [status, setStatus] = useState<TaskStatus | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [feedback, setFeedback] = useState('')
  const errorText = (error: Error) =>
    t(
      `dashboard.errors.${error instanceof ApiError ? error.code : 'NETWORK'}`,
      { defaultValue: t('dashboard.errors.NETWORK') },
    )
  const typeLabel = (type: TaskType) =>
    `${t(`dashboard.types.${type}`)} · ${TASK_COST[type]} ${t('dashboard.credits')}`
  const api = dashboardApi(key)
  const shopUrl = import.meta.env.VITE_SHOP_URL as string | undefined
  const session = useQuery({
    queryKey: ['dashboard', key, 'session'],
    queryFn: api.session,
    enabled: !!key,
    retry: false,
    refetchInterval: 10000,
  })
  const params = new URLSearchParams({ page: String(page), search })
  if (status) params.set('status', status)
  const list = useQuery({
    queryKey: ['dashboard', key, 'tasks', status, search, page],
    queryFn: () => api.list(params),
    enabled: !!key,
    retry: false,
    refetchInterval: 10000,
  })
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['dashboard', key] })
  const activation = useMutation({
    mutationFn: () => dashboardApi(draft.trim()).session(),
    onSuccess: (data) => {
      client.removeQueries({ queryKey: ['dashboard'] })
      const next = draft.trim()
      client.setQueryData(['dashboard', next, 'session'], data)
      setKey(next)
      setDraft('')
      setPage(1)
      setSearch('')
      setStatus('')
      setFeedback('')
    },
  })
  const submit = useMutation({
    mutationFn: () => api.submit(credential.trim(), taskType),
    onSuccess: async () => {
      setCredential('')
      setPage(1)
      setFeedback(t('dashboard.submitted'))
      await refresh()
    },
  })
  const cancel = useMutation({
    mutationFn: (id: number) => api.cancel(id),
    onSuccess: async () => {
      setFeedback(t('dashboard.cancelled'))
      if (list.data?.items.length === 1 && page > 1) setPage(page - 1)
      await refresh()
    },
  })
  const logout = () => {
    setKey('')
    setDraft('')
    setCredential('')
    setSearch('')
    setStatus('')
    setPage(1)
    setFeedback('')
    client.removeQueries({ queryKey: ['dashboard'] })
    activation.reset()
    submit.reset()
    cancel.reset()
  }
  const busy = submit.isPending || cancel.isPending
  const authFailed =
    session.error instanceof ApiError && session.error.status === 401
  const stats = list.data?.stats
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 10))
  const tableMessage = !key
    ? t('dashboard.locked')
    : list.isPending
      ? t('dashboard.loading')
      : !list.data?.items.length
        ? t(list.error ? 'dashboard.loadFailed' : 'dashboard.empty')
        : undefined
  return (
    <AppShell
      brand={<h1>{t('brand')}</h1>}
      actions={
        <>
          {key ? (
            <>
              <span className="text-sm" aria-live="polite">
                {t('dashboard.balance', {
                  balance: session.data?.balance ?? '—',
                })}
              </span>
              <Button variant="outline" onClick={logout} disabled={busy}>
                {t('dashboard.logout')}
              </Button>
            </>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                activation.mutate()
              }}
            >
              <Input
                aria-label={t('dashboard.key')}
                type="password"
                autoComplete="off"
                className="w-44 sm:w-56"
                placeholder={t('header.cdkeyPlaceholder')}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                required
                disabled={activation.isPending}
              />
              <Button
                type="submit"
                disabled={!draft.trim() || activation.isPending}
              >
                <KeyRound />
                {t(
                  activation.isPending
                    ? 'dashboard.activating'
                    : 'header.activate',
                )}
              </Button>
            </form>
          )}
          <Button
            variant="ghost"
            nativeButton={false}
            render={<a href="/api/docs" target="_blank" rel="noreferrer" />}
          >
            <BookOpen />
            {t('header.apiDocs')}
          </Button>
          {shopUrl ? (
            <Button
              variant="secondary"
              render={<a href={shopUrl} target="_blank" rel="noreferrer" />}
            >
              <ShoppingCart />
              {t('dashboard.purchase')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setPurchase(!purchase)}>
              <ShoppingCart />
              {t('dashboard.purchase')}
            </Button>
          )}
        </>
      }
    >
      {purchase && (
        <Notice tone="neutral" role="status">
          {t('dashboard.purchaseUnavailable')}
        </Notice>
      )}
      {activation.error && !key && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(activation.error)}
        </p>
      )}
      <Notice tone="info" className="space-y-1 p-5">
        <h2 className="font-semibold">{t('dashboard.securityTitle')}</h2>
        <p className="leading-7 text-foreground">
          {t('dashboard.securityBody')}
        </p>
      </Notice>
      {notice && (
        <Notice tone="danger" className="relative space-y-2 p-5 pr-12">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3"
            aria-label={t('dashboard.closeNotice')}
            onClick={() => setNotice(false)}
          >
            <X />
          </Button>
          <h2 className="font-semibold text-destructive">
            {t('dashboard.instructions')}
          </h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>{t(`dashboard.notice${n}`)}</li>
            ))}
          </ol>
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {(['total', ...TASK_STATUSES] as const).map((s) => (
          <Panel key={s} as="div" className="p-5 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              {t(`stats.${s}`)}
            </p>
            <p className={`text-3xl font-bold tabular-nums status-${s}`}>
              {key ? (stats?.[s] ?? '—') : 0}
            </p>
          </Panel>
        ))}
      </div>
      <Notice tone="neutral" className="space-y-1 p-5">
        <h2 className="font-semibold">{t('dashboard.queueTitle')}</h2>
        <p>{t('dashboard.queue', { count: stats?.pending ?? 0 })}</p>
        <p className="text-muted-foreground">
          {t('dashboard.workerUnavailable')}
        </p>
      </Notice>
      {key && (
        <>
          {session.error && (
            <p role="alert" className="text-sm text-destructive">
              {errorText(session.error)}
            </p>
          )}
          <Panel className="space-y-4">
            <PageTitle as="h2" className="text-base">
              {t('dashboard.create')}
            </PageTitle>
            <form
              className="flex flex-wrap items-end gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                setFeedback('')
                submit.mutate()
              }}
            >
              <Field label={t('dashboard.account')} className="min-w-72 flex-1">
                <Input
                  type="text"
                  autoComplete="off"
                  maxLength={400}
                  placeholder={t('dashboard.accountPlaceholder')}
                  required
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  disabled={busy || authFailed}
                />
              </Field>
              <div className="grid content-start gap-2 text-sm">
                <Label htmlFor="task-type" className="text-muted-foreground">
                  {t('dashboard.taskType')}
                </Label>
                <Select
                  value={taskType}
                  onValueChange={(value) => {
                    if (value) setTaskType(value as TaskType)
                  }}
                  disabled={busy || authFailed}
                >
                  <SelectTrigger id="task-type" className="min-w-44">
                    <SelectValue>
                      {(type: TaskType) => typeLabel(type)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {TASK_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {typeLabel(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={busy || authFailed || !credential.trim()}
              >
                {t(
                  submit.isPending
                    ? 'dashboard.submitting'
                    : 'dashboard.submit',
                )}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.accountFormat')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('dashboard.cost', { cost: TASK_COST[taskType] })}
            </p>
            {submit.error && (
              <p role="alert" className="text-sm text-destructive">
                {errorText(submit.error)}
              </p>
            )}
          </Panel>
        </>
      )}
      {feedback && (
        <p role="status" className="text-sm text-primary">
          {feedback}
        </p>
      )}
      {cancel.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(cancel.error)}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          label={t('dashboard.filter')}
          items={[
            { value: '', label: t('dashboard.all') },
            ...TASK_STATUSES.map((s) => ({ value: s, label: t(`stats.${s}`) })),
          ]}
          value={status}
          onChange={(next) => {
            setStatus(next)
            setPage(1)
          }}
          disabled={!key}
        />
        <div className="flex gap-2">
          <Input
            aria-label={t('dashboard.search')}
            placeholder={t('dashboard.search')}
            className="w-56"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            disabled={!key}
            maxLength={254}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label={t('dashboard.refresh')}
            onClick={() => {
              void refresh()
            }}
            disabled={!key || list.isFetching}
          >
            <RefreshCw className={list.isFetching ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>
      {list.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorText(list.error)}
        </p>
      )}
      <DataTable
        className="min-w-180"
        columns={(
          [
            'id',
            'email',
            'type',
            'status',
            'message',
            'completed',
            'actions',
          ] as const
        ).map((col) => t(`dashboard.columns.${col}`))}
        message={tableMessage}
      >
        {list.data?.items.map((task) => (
          <tr key={task.id}>
            <td className="tabular-nums">{task.id}</td>
            <td>{task.email}</td>
            <td>{t(`dashboard.types.${task.taskType}`)}</td>
            <td className={`font-medium status-${task.status}`}>
              {t(`stats.${task.status}`)}
            </td>
            <td className="max-w-64 break-words text-muted-foreground">
              {task.message === 'Awaiting execution service'
                ? t('dashboard.workerUnavailable')
                : (task.message ?? '—')}
            </td>
            <td>
              {task.completedAt
                ? new Date(task.completedAt).toLocaleString('zh-CN')
                : '—'}
            </td>
            <td>
              {task.status === 'pending' ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setFeedback('')
                    cancel.mutate(task.id)
                  }}
                  disabled={busy || authFailed}
                >
                  {t('dashboard.cancel')}
                </Button>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {!!key && (
        <Pagination
          summary={t('dashboard.pagination', {
            page,
            pages,
            count: list.data?.total ?? 0,
          })}
          previous={t('dashboard.previous')}
          next={t('dashboard.next')}
          page={page}
          pages={pages}
          disabled={list.isFetching}
          onChange={setPage}
        />
      )}
    </AppShell>
  )
}
