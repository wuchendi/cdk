import { describeRoute, resolver } from 'hono-openapi'
import type { ZodType } from 'zod'
import * as z from 'zod'

export { describeRoute, resolver }

export const TAGS = { System: 'System' } as const

type ResponsesMap = Record<
  number,
  {
    description: string
    content?: Record<string, { schema: ReturnType<typeof resolver> }>
  }
>

const json = (schema: ZodType) => ({
  'application/json': {
    schema: resolver(schema),
  },
})

/** `200 { success: true, data }` */
export function jsonOk(
  data: ZodType = z.unknown(),
  description = 'Success',
): ResponsesMap {
  return {
    200: {
      description,
      content: json(
        z.object({
          success: z.literal(true),
          data,
        }),
      ),
    },
  }
}
