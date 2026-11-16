import type { BatchItem, BatchResponse } from 'drizzle-orm/batch'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type * as schema from './schema'

/** Async SQLite shared by libSQL (Bun, Turso) and D1; multi-statement writes go through `batch`. */
export type Db = BaseSQLiteDatabase<'async', unknown, typeof schema> & {
  batch: <U extends BatchItem<'sqlite'>, T extends Readonly<[U, ...U[]]>>(
    batch: T,
  ) => Promise<BatchResponse<T>>
}
