import type { ReactNode } from 'react'
import { ScrollArea } from './ui/scroll-area'

/** Class for header navigation links; the router marks the current one `.active`. */
export const navLinkClass =
  'text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-primary'

/** Page frame shared by every app: brand, navigation, actions, content column. */
export function AppShell({
  brand,
  nav,
  actions,
  children,
}: {
  brand: ReactNode
  nav?: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3 sm:px-6">
          <div className="text-xl font-bold text-primary">{brand}</div>
          <nav className="flex flex-1 gap-6 text-sm">{nav}</nav>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
          {children}
        </main>
      </ScrollArea>
    </div>
  )
}
