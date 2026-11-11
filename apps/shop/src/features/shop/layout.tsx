import { AppShell, Button, navLinkClass } from '@cdk/ui'
import { Link, Outlet } from '@tanstack/react-router'
import { FileSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Layout() {
  const { t } = useTranslation()
  return (
    <AppShell
      brand={<Link to="/">{t('brand')}</Link>}
      nav={
        <Link to="/" className={navLinkClass} activeOptions={{ exact: true }}>
          {t('nav.home')}
        </Link>
      }
      actions={
        <Button variant="secondary" render={<Link to="/orders" />}>
          <FileSearch />
          {t('nav.orders')}
        </Button>
      }
    >
      <Outlet />
    </AppShell>
  )
}
