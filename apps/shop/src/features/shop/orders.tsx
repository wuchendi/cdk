import type { ShopOrder } from '@cdk/shared'
import { Button, Field, Input, PageTitle, Panel, Tabs } from '@cdk/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shopApi } from './api'
import { browserOrders } from './browser-orders'
import { OrderList, useErrorText } from './common'

const TABS = ['browser', 'password', 'number'] as const
type Tab = (typeof TABS)[number]

function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center">
      <p>{title}</p>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Loaded({
  query,
  empty,
  hint,
}: {
  query: { data?: ShopOrder[]; isPending: boolean; error: Error | null }
  empty: string
  hint?: string
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  if (query.error)
    return (
      <p className="text-sm text-destructive" role="alert">
        {errorText(query.error)}
      </p>
    )
  if (query.isPending)
    return <p className="text-sm text-muted-foreground">{t('query.loading')}</p>
  return query.data?.length ? (
    <OrderList orders={query.data} />
  ) : (
    <Empty title={empty} hint={hint} />
  )
}

function Browser() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: ['orders', 'browser'],
    queryFn: async () => {
      const found = await Promise.all(
        browserOrders().map((no) => shopApi.order(no).catch(() => null)),
      )
      return found.filter((order) => order !== null)
    },
  })
  return (
    <Loaded
      query={query}
      empty={t('query.browserEmpty')}
      hint={t('query.browserEmptyHint')}
    />
  )
}

function ByPassword() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const lookup = useMutation({
    mutationFn: () => shopApi.lookup(email.trim(), password),
  })
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          lookup.mutate()
        }}
      >
        <Field label={t('query.email')} className="min-w-48 flex-1">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label={t('query.password')} className="min-w-48 flex-1">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </Field>
        <Button type="submit" disabled={lookup.isPending}>
          {t(lookup.isPending ? 'query.searching' : 'query.search')}
        </Button>
      </form>
      {lookup.isError && (
        <p className="text-sm text-destructive" role="alert">
          {errorText(lookup.error)}
        </p>
      )}
      {lookup.data &&
        (lookup.data.length ? (
          <OrderList orders={lookup.data} />
        ) : (
          <Empty title={t('query.noMatch')} />
        ))}
    </div>
  )
}

function ByNumber() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [orderNo, setOrderNo] = useState('')
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void navigate({
          to: '/orders/$orderNo',
          params: { orderNo: orderNo.trim() },
        })
      }}
    >
      <Field label={t('query.orderNo')} className="min-w-64 flex-1">
        <Input
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          maxLength={64}
          required
        />
      </Field>
      <Button type="submit" disabled={!orderNo.trim()}>
        {t('query.search')}
      </Button>
    </form>
  )
}

export function Orders() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('browser')
  return (
    <Panel className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-1">
        <PageTitle>{t('query.title')}</PageTitle>
        <p className="pl-4 text-sm text-muted-foreground">
          {t('query.subtitle')}
        </p>
      </div>
      <Tabs
        items={TABS.map((item) => ({
          value: item,
          label: t(`query.tabs.${item}`),
        }))}
        value={tab}
        onChange={setTab}
        className="[&>button]:flex-1"
      />
      <div role="tabpanel">
        {tab === 'browser' && <Browser />}
        {tab === 'password' && <ByPassword />}
        {tab === 'number' && <ByNumber />}
      </div>
    </Panel>
  )
}
