import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (value: string) => createHash('sha256').update(value).digest()

/** Constant-time equality for secrets of any length. */
export const sameSecret = (given: string, expected: string) =>
  timingSafeEqual(digest(given), digest(expected))
