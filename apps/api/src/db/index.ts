import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { root } from '@/root'
import * as schema from './schema'

export function createDb(file = root.data('db', 'cdk.db')) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true })
  const sqlite = new Database(file, { create: true })
  sqlite.run('PRAGMA journal_mode = WAL')
  sqlite.run('PRAGMA foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, {
    migrationsFolder: root.asset('drizzle'),
  })
  return {
    db,
    close: () => sqlite.close(),
  }
}

export type Db = ReturnType<typeof createDb>['db']
