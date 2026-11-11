import type { AdminProduct } from '@cdk/shared'
import {
  Badge,
  Button,
  Checkbox,
  DataTable,
  Field,
  Input,
  PageTitle,
  Panel,
} from '@cdk/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProductInput } from './api'
import { adminApi, useErrorText, yuan } from './api'

interface Draft {
  id?: number
  name: string
  description: string
  credits: string
  price: string
  sort: string
  active: boolean
}

const EMPTY: Draft = {
  name: '',
  description: '',
  credits: '1',
  price: '',
  sort: '0',
  active: true,
}

function ProductForm({
  initial,
  onClose,
}: {
  initial: Draft
  onClose: () => void
}) {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const client = useQueryClient()
  const [draft, setDraft] = useState(initial)
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const save = useMutation({
    mutationFn: () => {
      const input: ProductInput = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        credits: Number(draft.credits),
        price: Math.round(Number(draft.price) * 100),
        sort: Number(draft.sort),
        active: draft.active,
      }
      return draft.id
        ? adminApi.updateProduct(draft.id, input)
        : adminApi.createProduct(input)
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['admin', 'products'] })
      onClose()
    },
  })
  return (
    <Panel
      as="form"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <h2 className="font-semibold">
        {t(draft.id ? 'products.edit' : 'products.create')}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('products.name')}>
          <Input
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={100}
            required
          />
        </Field>
        <Field label={t('products.description')}>
          <Input
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={500}
          />
        </Field>
        <Field label={t('products.credits')}>
          <Input
            type="number"
            min="0.5"
            step="0.5"
            value={draft.credits}
            onChange={(e) => set({ credits: e.target.value })}
            required
          />
        </Field>
        <Field label={t('products.price')}>
          <Input
            type="number"
            min="0.01"
            step="0.01"
            value={draft.price}
            onChange={(e) => set({ price: e.target.value })}
            required
          />
        </Field>
        <Field label={`${t('products.sort')}（${t('products.sortHint')}）`}>
          <Input
            type="number"
            min="0"
            step="1"
            value={draft.sort}
            onChange={(e) => set({ sort: e.target.value })}
            required
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
          <Checkbox
            checked={draft.active}
            onCheckedChange={(value) => set({ active: value === true })}
          />
          {t('products.active')}
        </label>
      </div>
      {save.isError && (
        <p className="text-sm text-destructive" role="alert">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {t(save.isPending ? 'products.saving' : 'products.save')}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('products.cancel')}
        </Button>
      </div>
    </Panel>
  )
}

const toDraft = (p: AdminProduct): Draft => ({
  id: p.id,
  name: p.name,
  description: p.description,
  credits: String(p.credits),
  price: (p.price / 100).toFixed(2),
  sort: String(p.sort),
  active: p.active,
})

export function Products() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const client = useQueryClient()
  const [editing, setEditing] = useState<Draft>()
  const list = useQuery({
    queryKey: ['admin', 'products'],
    queryFn: adminApi.products,
    retry: false,
  })
  const toggle = useMutation({
    mutationFn: (p: AdminProduct) =>
      adminApi.updateProduct(p.id, { active: !p.active }),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['admin', 'products'] }),
  })
  const error = list.error ?? toggle.error
  const columns = [
    'id',
    'name',
    'credits',
    'price',
    'sold',
    'sort',
    'status',
    'actions',
  ] as const
  return (
    <>
      <div className="flex items-center justify-between">
        <PageTitle>{t('products.title')}</PageTitle>
        <Button onClick={() => setEditing(EMPTY)}>
          <Plus />
          {t('products.create')}
        </Button>
      </div>
      {editing && (
        <ProductForm
          key={editing.id ?? 'new'}
          initial={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {errorText(error)}
        </p>
      )}
      <DataTable
        columns={columns.map((column) => t(`products.columns.${column}`))}
        message={
          list.isPending
            ? t('products.loading')
            : list.data?.length === 0
              ? t('products.empty')
              : undefined
        }
      >
        {list.data?.map((product) => (
          <tr key={product.id}>
            <td className="tabular-nums">{product.id}</td>
            <td>
              <p className="font-medium">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.description}
              </p>
            </td>
            <td className="tabular-nums">{product.credits}</td>
            <td className="tabular-nums">{yuan(product.price)}</td>
            <td className="tabular-nums">{product.sold}</td>
            <td className="tabular-nums">{product.sort}</td>
            <td>
              <Badge variant={product.active ? 'default' : 'outline'}>
                {t(product.active ? 'products.listed' : 'products.unlisted')}
              </Badge>
            </td>
            <td>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={toggle.isPending}
                  aria-label={`${t(product.active ? 'products.unlist' : 'products.list')} ${product.name}`}
                  onClick={() => toggle.mutate(product)}
                >
                  {t(product.active ? 'products.unlist' : 'products.list')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${t('products.edit')} ${product.name}`}
                  onClick={() => setEditing(toDraft(product))}
                >
                  {t('products.edit')}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </>
  )
}
