import { PageTitle } from '@cdk/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { KeyRound, Megaphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { shopApi, yuan } from './api'

const RULES = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5'] as const

export function Home() {
  const { t } = useTranslation()
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: shopApi.catalog })
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border bg-card">
        <h2 className="flex items-center gap-2 bg-accent px-5 py-3 font-semibold">
          <Megaphone className="size-4 text-primary" />
          {t('notice.title')}
        </h2>
        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="text-base font-medium">{t('notice.lead')}</p>
          <div>
            <h3 className="mb-2 font-semibold text-primary">
              {t('notice.rulesTitle')}
            </h3>
            <ol className="space-y-1.5">
              {RULES.map((rule, index) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  {t(`notice.${rule}`)}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <PageTitle as="h2">{t('home.products')}</PageTitle>
        {catalog.isPending && (
          <p className="text-sm text-muted-foreground">{t('home.loading')}</p>
        )}
        {catalog.isError && (
          <p className="text-sm text-destructive" role="alert">
            {t('home.loadFailed')}
          </p>
        )}
        {catalog.data?.products.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('home.empty')}</p>
        )}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {catalog.data?.products.map((product) => (
            <li key={product.id}>
              <Link
                to="/products/$id"
                params={{ id: String(product.id) }}
                className="block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary to-indigo-400 text-primary-foreground">
                  <span className="absolute top-2 right-2 rounded bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                    {t('home.autoDelivery')}
                  </span>
                  <KeyRound className="size-8" />
                  <span className="text-lg font-bold">
                    {t('home.credits', { count: product.credits })}
                  </span>
                </div>
                <div className="space-y-2 p-4">
                  <p className="font-medium">{product.name}</p>
                  <div className="flex items-end justify-between">
                    <span className="text-lg font-bold text-red-500 tabular-nums">
                      {yuan(product.price)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('home.sold', { count: product.sold })}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
