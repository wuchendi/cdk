import * as z from 'zod'
import pkg from '../package.json'

const optional = z
  .string()
  .optional()
  .transform((v) => v?.trim() || undefined)

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ALIPAY_APP_ID: optional,
  ALIPAY_PRIVATE_KEY: optional,
  ALIPAY_PUBLIC_KEY: optional,
  ALIPAY_GATEWAY: optional.pipe(
    z.url().default('https://openapi.alipay.com/gateway.do'),
  ),
  USDT_TRC20_ADDRESS: optional,
  USDT_CNY_RATE: optional
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .pipe(z.number().positive().optional()),
  TRONGRID_URL: optional.pipe(z.url().default('https://api.trongrid.io')),
  TRONGRID_API_KEY: optional,
  ADMIN_TOKEN: optional.pipe(z.string().min(16).optional()),
  SHOP_MOCK_PAY: optional.transform((v) => v === 'true'),
})

export type Config = z.infer<typeof schema> & { VERSION: string }

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success)
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`)
  return { ...parsed.data, VERSION: pkg.version }
}
