import { createFileRoute } from '@tanstack/react-router'
import { Orders } from '@/features/shop/orders'

export const Route = createFileRoute('/orders/')({ component: Orders })
