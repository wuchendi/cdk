import { createFileRoute } from '@tanstack/react-router'
import { Products } from '@/features/admin/products'

export const Route = createFileRoute('/')({ component: Products })
