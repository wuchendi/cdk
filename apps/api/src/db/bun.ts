import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { root } from '@/root'
import type { Db } from './index'
import * as schema from './schema'

/** Opens a local `file:`, `:memory:` or remote libSQL database and migrates it. */
export async function createDb(
  url = `file:${root.data('db', 'cdk.db')}`,
  authToken?: string,
): Promise<{ db: Db; close: () => void }> {
  const local = url === ':memory:' || url.startsWith('file:')
  if (url.startsWith('file:'))
    mkdirSync(dirname(url.slice('file:'.length)), { recursive: true })
  const client = createClient({ url, authToken })
  if (url.startsWith('file:')) await client.execute('PRAGMA journal_mode = WAL')
  if (local) await client.execute('PRAGMA foreign_keys = ON')
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: root.asset('drizzle') })
  return { db, close: () => client.close() }
}
