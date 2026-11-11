import type { AdminOrder, OrderStatus } from '@cdk/shared'
import { ORDER_STATUSES } from '@cdk/shared'
import {
  Badge,
  Button,
  DataTable,
  Input,
  PageTitle,
  Pagination,
  Tabs,
} from '@cdk/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi, useErrorText, yuan } from './api'

const STATUS_VARIANT = {
  pending: 'secondary',
  paid: 'default',
  expired: 'outline',
} as const
const COLUMNS = [
  'order',
  'buyer',
  'product',
  'amount',
  'method',
  'status',
  'createdAt',
  'actions',
  'keys',
] as const

export function Orders() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const client = useQueryClient()
  const [status, setStatus] = useState<OrderStatus>()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const list = useQuery({
    queryKey: ['admin', 'orders', status, search, page],
    queryFn: () => adminApi.orders({ status, search, page }),
    retry: false,
  })
  const settle = useMutation({
    mutationFn: (order: AdminOrder) => adminApi.settle(order.orderNo),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'orders'] }),
  })
  const error = list.error ?? settle.error
  const pages = Math.max(
    1,
    Math.ceil((list.data?.total ?? 0) / (list.data?.pageSize ?? 1)),
  )
  const pick = (next?: OrderStatus) => {
    setStatus(next)
    setPage(1)
  }
  return (
    <>
      <PageTitle>{t('orders.title')}</PageTitle>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { value: '', label: t('orders.all') },
            ...ORDER_STATUSES.map((item) => ({
              value: item,
              label: t(`orders.status.${item}`),
            })),
          ]}
          value={status ?? ''}
          onChange={(next) => pick(next || undefined)}
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
            aria-label={t('orders.search')}
            placeholder={t('orders.search')}
            className="w-64"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button type="submit" variant="outline">
            {t('orders.searchSubmit')}
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
        columns={COLUMNS.map((column) => t(`orders.columns.${column}`))}
        message={
          list.isPending
            ? t('orders.loading')
            : list.data?.items.length === 0
              ? t('orders.empty')
              : undefined
        }
      >
        {list.data?.items.map((order) => (
          <tr key={order.orderNo}>
            <td className="font-mono text-xs whitespace-nowrap">
              {order.orderNo}
            </td>
            <td>{order.email}</td>
            <td className="whitespace-nowrap">
              {order.productName} × {order.quantity}
            </td>
            <td className="tabular-nums">{yuan(order.amount)}</td>
            <td className="whitespace-nowrap">
              {t(`orders.methods.${order.method}`)}
            </td>
            <td>
              <Badge variant={STATUS_VARIANT[order.status]}>
                {t(`orders.status.${order.status}`)}
              </Badge>
            </td>
            <td className="whitespace-nowrap">
              {new Date(order.createdAt).toLocaleString('zh-CN')}
            </td>
            <td>
              {order.status !== 'paid' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={settle.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        t('orders.settleConfirm', {
                          orderNo: order.orderNo,
                          quantity: order.quantity,
                        }),
                      )
                    )
                      settle.mutate(order)
                  }}
                >
                  {t('orders.settle')}
                </Button>
              )}
            </td>
            <td className="space-y-1 font-mono text-xs whitespace-nowrap">
              {order.keys.map((key) => (
                <p key={key}>{key}</p>
              ))}
              {order.tradeNo && (
                <p className="text-muted-foreground">{order.tradeNo}</p>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination
        summary={t('orders.pagination', {
          page,
          pages,
          count: list.data?.total ?? 0,
        })}
        previous={t('orders.previous')}
        next={t('orders.next')}
        page={page}
        pages={pages}
        onChange={setPage}
      />
    </>
  )
}
