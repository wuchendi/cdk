import { join } from 'node:path'

const apiDir = process.env.ROOT_DIR ?? join(import.meta.dir, '..')
const repoDir = join(apiDir, '..', '..')

export const root = {
  /** Read-only assets shipped with the API (migrations). */
  asset: (...p: string[]) => join(apiDir, ...p),
  /** Built SPAs (dashboard at the root, `shop/`, `admin/`). */
  web: (...p: string[]) => join(repoDir, 'dist', ...p),
  /** Writable runtime state (SQLite, logs). */
  data: (...p: string[]) =>
    join(process.env.DATA_DIR || join(repoDir, 'data'), ...p),
}
