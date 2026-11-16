import { describe, expect, it } from 'bun:test'
import { hashPassword, verifyPassword } from '@/shared/lib/password'

describe('order password hashing', () => {
  it('verifies the right password only', async () => {
    const stored = await hashPassword('order-pass')
    expect(stored).toMatch(/^pbkdf2\$100000\$/)
    expect(stored).not.toBe(await hashPassword('order-pass'))
    expect(await verifyPassword('order-pass', stored)).toBe(true)
    expect(await verifyPassword('order-pas', stored)).toBe(false)
  })
  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('x', '')).toBe(false)
    expect(await verifyPassword('x', '$argon2id$v=19$m=65536')).toBe(false)
  })
})
