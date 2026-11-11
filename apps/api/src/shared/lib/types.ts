import type { Config } from '@/config'
import type { Db } from '@/db'
import type { Logger } from '@/logger'

export interface AppEnv {
  Variables: {
    config: Config
    db: Db
    logger: Logger
  }
}
