import { createApp } from '@/app'
import { loadConfig } from '@/config'
import { createDb } from '@/db/bun'
import { createLogger } from '@/logger'
import { payMethods, syncUsdt } from '@/modules/shop/payments'
import { root } from '@/root'
import { spaAssets } from '@/static'

const config = loadConfig()
const logger = createLogger(config.LOG_LEVEL)
const { db, close } = await createDb(
  config.DATABASE_URL,
  config.DATABASE_AUTH_TOKEN,
)
const app = createApp({
  config,
  db,
  logger,
  assets: config.NODE_ENV === 'production' ? spaAssets(root.web()) : undefined,
})

const server = Bun.serve({ port: config.PORT, fetch: app.fetch })
logger.info({ url: server.url.href, env: config.NODE_ENV }, 'cdk api started')

if (payMethods(config).includes('mock'))
  logger.warn('mock payment is enabled: orders can be settled without paying')

let syncing = false
const usdtTimer = payMethods(config).includes('usdt')
  ? setInterval(() => {
      if (syncing) return
      syncing = true
      syncUsdt(db, config, fetch)
        .catch((err) => logger.error({ err }, 'usdt sync failed'))
        .finally(() => {
          syncing = false
        })
    }, 15_000)
  : undefined

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  clearInterval(usdtTimer)
  server.stop()
  close()
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
