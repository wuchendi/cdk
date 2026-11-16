import type { ShopOrder } from '@cdk/shared'
import { ApiError, Button, Field, Input, Notice, Panel } from '@cdk/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleCheck, Loader } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shopApi, usdt, yuan } from './api'
import { CopyButton, StatusBadge, useErrorText } from './common'
import { Turnstile } from './turnstile'

function useCountdown(expiresAt: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const left = Math.max(0, Math.floor((Date.parse(expiresAt) - now) / 1000))
  return `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`
}

function MockPayment({ order }: { order: ShopOrder }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const client = useQueryClient()
  const time = useCountdown(order.expiresAt)
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: shopApi.catalog })
  const [code, setCode] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const needsCode = catalog.data?.testPayCode ?? false
  const siteKey = catalog.data?.turnstileSiteKey ?? null
  const pay = useMutation({
    mutationFn: () =>
      shopApi.mockPay(order.orderNo, {
        ...(needsCode ? { code } : {}),
        ...(token ? { turnstileToken: token } : {}),
      }),
    onSuccess: (paid) => client.setQueryData(['order', order.orderNo], paid),
    // Turnstile tokens are single-use.
    onError: () => setResetKey((k) => k + 1),
  })
  const ready = catalog.isSuccess && (!needsCode || code) && (!siteKey || token)
  return (
    <Panel className="space-y-4 text-sm">
      <h2 className="text-lg font-semibold">{t('order.payTitle', { time })}</h2>
      <p className="text-3xl font-bold text-red-500 tabular-nums">
        {yuan(order.payAmount)}
      </p>
      <Notice tone="warning">{t('order.mockHint')}</Notice>
      {needsCode && (
        <Field label={t('order.testCode')} className="max-w-xs">
          <Input
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
      )}
      {siteKey && (
        <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
      )}
      <Button
        size="lg"
        disabled={!ready || pay.isPending}
        onClick={() => pay.mutate()}
      >
        {t(pay.isPending ? 'order.mockPaying' : 'order.mockPay')}
      </Button>
      {pay.isError && (
        <p className="text-destructive" role="alert">
          {errorText(pay.error)}
        </p>
      )}
    </Panel>
  )
}

function Payment({ order }: { order: ShopOrder }) {
  const { t } = useTranslation()
  const time = useCountdown(order.expiresAt)
  const target = order.payTarget ?? ''
  return (
    <Panel className="grid gap-6 sm:grid-cols-[auto_1fr]">
      <div className="mx-auto self-start rounded-lg border bg-white p-3">
        <QRCodeSVG value={target} size={180} />
      </div>
      <div className="space-y-4 text-sm">
        <h2 className="text-lg font-semibold">
          {t('order.payTitle', { time })}
        </h2>
        {order.method === 'alipay' ? (
          <>
            <p className="text-3xl font-bold text-red-500 tabular-nums">
              {yuan(order.payAmount)}
            </p>
            <p className="text-muted-foreground">{t('order.alipayHint')}</p>
            <Button
              variant="outline"
              render={<a href={target} target="_blank" rel="noreferrer" />}
            >
              {t('order.alipayOpen')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{t('order.usdtHint')}</p>
            <dl className="space-y-3">
              <div>
                <dt className="text-muted-foreground">
                  {t('order.usdtAmount')}
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <span className="text-2xl font-bold text-red-500 tabular-nums">
                    {usdt(order.payAmount)}
                  </span>
                  <CopyButton value={usdt(order.payAmount)} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">
                  {t('order.usdtAddress')}
                </dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <span className="font-mono break-all">{target}</span>
                  <CopyButton value={target} />
                </dd>
              </div>
            </dl>
            <Notice tone="warning">{t('order.usdtWarning')}</Notice>
          </>
        )}
        <p
          className="flex items-center gap-2 text-muted-foreground"
          aria-live="polite"
        >
          <Loader className="size-4 animate-spin" />
          {t('order.waiting')}
        </p>
      </div>
    </Panel>
  )
}

function Keys({ order }: { order: ShopOrder }) {
  const { t } = useTranslation()
  const dashboard = import.meta.env.VITE_DASHBOARD_URL
  return (
    <Panel className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-600">
        <CircleCheck className="size-5" />
        {t('order.paidTitle')}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t('order.paidHint', { credits: order.credits })}
      </p>
      <ul className="space-y-2">
        {order.keys.map((key) => (
          <li
            key={key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted px-3 py-2"
          >
            <code className="font-mono break-all">{key}</code>
            <CopyButton value={key} />
          </li>
        ))}
      </ul>
      {dashboard && (
        <Button
          render={<a href={dashboard} target="_blank" rel="noreferrer" />}
        >
          {t('order.dashboard')}
        </Button>
      )}
    </Panel>
  )
}

export function Order({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const query = useQuery({
    queryKey: ['order', orderNo],
    queryFn: () => shopApi.order(orderNo),
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 3000 : false),
    retry: false,
  })
  const order = query.data
  if (!order)
    return (
      <p role={query.isError ? 'alert' : undefined}>
        {query.isError
          ? query.error instanceof ApiError && query.error.status === 404
            ? t('order.notFound')
            : errorText(query.error)
          : t('order.loading')}
      </p>
    )
  const rows = [
    [t('order.product'), order.productName],
    [t('order.quantity'), order.quantity],
    [t('order.amount'), yuan(order.amount)],
    [t('order.method'), t(`product.methods.${order.method}`)],
    [t('order.createdAt'), new Date(order.createdAt).toLocaleString('zh-CN')],
  ] as const
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {order.status === 'pending' &&
        (order.method === 'mock' ? (
          <MockPayment order={order} />
        ) : (
          <Payment order={order} />
        ))}
      {order.status === 'paid' && <Keys order={order} />}
      {order.status === 'expired' && (
        <Panel className="space-y-4">
          <p role="alert">{t('order.expired')}</p>
          <Button render={<Link to="/" />}>{t('order.reorder')}</Button>
        </Panel>
      )}
      <Panel className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">{t('order.title')}</h1>
          <StatusBadge status={order.status} />
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted-foreground">{t('order.orderNo')}</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <span className="font-mono break-all">{order.orderNo}</span>
            <CopyButton value={order.orderNo} />
          </dd>
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  )
}
