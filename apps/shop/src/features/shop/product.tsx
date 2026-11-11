import type { PayMethod } from '@cdk/shared'
import { Button, Field, Input, Panel } from '@cdk/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { KeyRound, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { shopApi, yuan } from './api'
import { rememberOrder } from './browser-orders'
import { useErrorText } from './common'

const MAX_QUANTITY = 20

export function Product({ id }: { id: number }) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const navigate = useNavigate()
  const client = useQueryClient()
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: shopApi.catalog })
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [picked, setPicked] = useState<PayMethod>()
  const methods = catalog.data?.methods ?? []
  const method = picked ?? methods[0]
  const product = catalog.data?.products.find((p) => p.id === id)
  const order = useMutation({
    mutationFn: (payMethod: PayMethod) =>
      shopApi.createOrder({
        productId: id,
        quantity,
        method: payMethod,
        email: email.trim(),
        password,
      }),
    onSuccess: async (created) => {
      rememberOrder(created.orderNo)
      client.setQueryData(['order', created.orderNo], created)
      await navigate({
        to: '/orders/$orderNo',
        params: { orderNo: created.orderNo },
      })
    },
  })
  if (catalog.isPending)
    return <p className="text-sm text-muted-foreground">{t('home.loading')}</p>
  if (!product)
    return (
      <div className="space-y-4">
        <p role="alert">
          {t(catalog.isError ? 'home.loadFailed' : 'product.notFound')}
        </p>
        <Button variant="outline" render={<Link to="/" />}>
          {t('product.back')}
        </Button>
      </div>
    )
  return (
    <Panel as="div" className="grid gap-8 md:grid-cols-[2fr_3fr]">
      <div className="flex aspect-square flex-col items-center justify-center gap-3 rounded-lg bg-gradient-to-br from-primary to-indigo-400 text-primary-foreground">
        <KeyRound className="size-14" />
        <span className="text-2xl font-bold">
          {t('home.credits', { count: product.credits })}
        </span>
      </div>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (method) order.mutate(method)
        }}
      >
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {product.description} · {t('home.sold', { count: product.sold })}
          </p>
        </div>
        <p className="rounded-lg bg-red-50 px-5 py-4 text-2xl font-bold text-red-500 tabular-nums">
          {yuan(product.price)}
        </p>
        <div className="space-y-2">
          <span className="block text-sm text-muted-foreground">
            {t('product.quantity')}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('product.decrease')}
              disabled={quantity <= 1}
              onClick={() => setQuantity(quantity - 1)}
            >
              <Minus />
            </Button>
            <output className="w-10 text-center tabular-nums">
              {quantity}
            </output>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('product.increase')}
              disabled={quantity >= MAX_QUANTITY}
              onClick={() => setQuantity(quantity + 1)}
            >
              <Plus />
            </Button>
          </div>
        </div>
        <div className="grid max-w-md gap-4 sm:grid-cols-2">
          <Field label={t('product.email')}>
            <Input
              type="email"
              autoComplete="email"
              placeholder={t('product.emailHint')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label={t('product.password')}>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t('product.passwordHint')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </Field>
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm text-muted-foreground">
            {t('product.method')}
          </legend>
          {methods.length === 0 && (
            <p className="text-sm text-destructive">{t('product.noMethods')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {methods.map((item) => (
              <Button
                key={item}
                type="button"
                variant="outline"
                aria-pressed={item === method}
                className="aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground"
                onClick={() => setPicked(item)}
              >
                {t(`product.methods.${item}`)}
              </Button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" size="lg" disabled={!method || order.isPending}>
            {t(order.isPending ? 'product.buying' : 'product.buy')}
          </Button>
          <span className="text-sm">
            {t('product.total')}{' '}
            <strong className="text-lg text-red-500 tabular-nums">
              {yuan(product.price * quantity)}
            </strong>
          </span>
        </div>
        {order.isError && (
          <p className="text-sm text-destructive" role="alert">
            {errorText(order.error)}
          </p>
        )}
      </form>
    </Panel>
  )
}
