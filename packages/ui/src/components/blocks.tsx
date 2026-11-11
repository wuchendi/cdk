import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { TableBody, TableHead, TableHeader, TableRow } from './ui/table'
import { TabsList, Tabs as TabsRoot, TabsTrigger } from './ui/tabs'

/** Page or section heading with the accent bar. */
export function PageTitle({
  as: Tag = 'h1',
  className,
  ...props
}: ComponentProps<'h1'> & { as?: 'h1' | 'h2' }) {
  return (
    <Tag
      className={cn(
        'border-l-4 border-primary pl-3 text-xl font-bold',
        className,
      )}
      {...props}
    />
  )
}

/** White content card. */
export function Panel({
  as: Tag = 'section',
  className,
  ...props
}: ComponentProps<'section'> & { as?: 'section' | 'div' | 'form' }) {
  const Element = Tag as 'section'
  return (
    <Element
      className={cn('rounded-xl border bg-card p-6', className)}
      {...props}
    />
  )
}

const NOTICE_TONE = {
  info: 'border-primary/30 bg-accent text-accent-foreground',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  danger: 'border-destructive/30 bg-destructive/5 text-foreground',
  neutral: 'bg-muted text-foreground',
} as const

/** Tinted callout box. */
export function Notice({
  tone = 'info',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: keyof typeof NOTICE_TONE }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 text-sm',
        NOTICE_TONE[tone],
        className,
      )}
      {...props}
    />
  )
}

/** Labelled form control; the label wraps the control. */
export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('grid content-start gap-2 text-sm', className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** Segmented control for switching views or filters. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  items: readonly { value: T; label: ReactNode }[]
  value: T
  onChange: (value: T) => void
  label?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <TabsRoot
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={className}
    >
      <TabsList aria-label={label}>
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value} disabled={disabled}>
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  )
}

/** Table shell; `message` replaces the body for loading and empty states. */
export function DataTable({
  columns,
  message,
  className,
  children,
}: {
  columns: readonly ReactNode[]
  message?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <ScrollArea className="rounded-xl border bg-card">
      <table
        className={cn(
          'w-full caption-bottom text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3',
          className,
        )}
      >
        <TableHeader className="bg-muted">
          <TableRow>
            {columns.map((column, index) => (
              <TableHead
                // biome-ignore lint/suspicious/noArrayIndexKey: columns are static
                key={index}
                className="font-medium whitespace-nowrap text-muted-foreground"
              >
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y">
          {message ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-12! text-center text-muted-foreground"
              >
                {message}
              </td>
            </tr>
          ) : (
            children
          )}
        </TableBody>
      </table>
    </ScrollArea>
  )
}

/** Page summary with previous / next buttons. */
export function Pagination({
  summary,
  previous,
  next,
  page,
  pages,
  disabled,
  onChange,
}: {
  summary: ReactNode
  previous: string
  next: string
  page: number
  pages: number
  disabled?: boolean
  onChange: (page: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{summary}</span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          {previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          {next}
        </Button>
      </div>
    </div>
  )
}
