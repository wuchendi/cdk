import { Badge } from '@cdk/ui'
import { useTranslation } from 'react-i18next'
import { useHealthQuery } from './api'

export function ApiStatus() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useHealthQuery()

  if (isPending) return <Badge variant="outline">{t('system.checking')}</Badge>
  if (isError) return <Badge variant="destructive">{t('system.offline')}</Badge>
  return (
    <Badge variant="secondary">
      {t('system.online', { version: data.version })}
    </Badge>
  )
}
