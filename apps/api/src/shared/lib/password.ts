const ITERATIONS = 100_000
const encoder = new TextEncoder()
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

/** PBKDF2-SHA256 as `pbkdf2$<iterations>$<salt>$<hash>` (base64). */
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  return ['pbkdf2', ITERATIONS, b64(salt), b64(hash)].join('$')
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, iterations, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iterations || !salt || !hash) return false
  const expected = unb64(hash)
  const actual = await derive(password, unb64(salt), Number(iterations))
  let diff = actual.length ^ expected.length
  for (let i = 0; i < actual.length; i++)
    diff |= (actual[i] ?? 0) ^ (expected[i] ?? 0)
  return diff === 0
}
