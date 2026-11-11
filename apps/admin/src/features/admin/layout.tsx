import {
  AppShell,
  Button,
  Field,
  Input,
  navLinkClass,
  PageTitle,
  Panel,
} from '@cdk/ui'
import { useMutation } from '@tanstack/react-query'
import { Link, Outlet } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi, useErrorText } from './api'
import { setToken, useToken } from './token'

function Login() {
  const { t } = useTranslation()
  const errorText = useErrorText()
  const [draft, setDraft] = useState('')
  const login = useMutation({
    mutationFn: () => adminApi.check(draft.trim()),
    onSuccess: () => setToken(draft.trim()),
  })
  return (
    <Panel
      as="form"
      className="mx-auto mt-16 max-w-sm space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        login.mutate()
      }}
    >
      <PageTitle className="text-lg">{t('login.title')}</PageTitle>
      <Field label={t('login.token')} hint={t('login.hint')}>
        <Input
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          required
        />
      </Field>
      {login.isError && (
        <p className="text-sm text-destructive" role="alert">
          {errorText(login.error)}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {t(login.isPending ? 'login.submitting' : 'login.submit')}
      </Button>
    </Panel>
  )
}

const NAV = [
  { to: '/', label: 'nav.products' },
  { to: '/tasks', label: 'nav.tasks' },
  { to: '/orders', label: 'nav.orders' },
] as const

export function Layout() {
  const { t } = useTranslation()
  const token = useToken()
  if (!token)
    return (
      <AppShell brand={t('brand')}>
        <Login />
      </AppShell>
    )
  return (
    <AppShell
      brand={t('brand')}
      nav={NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          activeOptions={{ exact: true }}
          className={navLinkClass}
        >
          {t(item.label)}
        </Link>
      ))}
      actions={
        <Button variant="ghost" onClick={() => setToken(null)}>
          <LogOut />
          {t('nav.logout')}
        </Button>
      }
    >
      <Outlet />
    </AppShell>
  )
}
