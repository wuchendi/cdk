import { createFileRoute } from '@tanstack/react-router'
import { Orders } from '@/features/admin/orders'

export const Route = createFileRoute('/orders')({ component: Orders })
