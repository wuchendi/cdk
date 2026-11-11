import type { ShopOrder } from '@cdk/shared'
import { ApiError, Badge, Button } from '@cdk/ui'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { yuan } from './api'

export function useErrorText() {
  const { t } = useTranslation()
  return (error: Error) =>
    t(`errors.${error instanceof ApiError ? error.code : 'NETWORK'}`, {
      defaultValue: t('errors.NETWORK'),
    })
}

export function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {t(copied ? 'order.copied' : 'order.copy')}
    </Button>
  )
}

const STATUS_VARIANT = {
  pending: 'secondary',
  paid: 'default',
  expired: 'outline',
} as const

export function StatusBadge({ status }: { status: ShopOrder['status'] }) {
  const { t } = useTranslation()
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {t(`order.status.${status}`)}
    </Badge>
  )
}

export function OrderList({ orders }: { orders: ShopOrder[] }) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {orders.map((order) => (
        <li
          key={order.orderNo}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        >
          <div className="min-w-0 space-y-1">
            <p className="font-medium">
              {order.productName} × {order.quantity}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {order.orderNo}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold tabular-nums">
              {yuan(order.amount)}
            </span>
            <StatusBadge status={order.status} />
            <Button
              variant="outline"
              size="sm"
              render={
                <Link
                  to="/orders/$orderNo"
                  params={{ orderNo: order.orderNo }}
                />
              }
            >
              {t('query.view')}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
