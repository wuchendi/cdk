import { createFileRoute } from '@tanstack/react-router'
import { Order } from '@/features/shop/order'

export const Route = createFileRoute('/orders/$orderNo')({ component: Page })

function Page() {
  return <Order orderNo={Route.useParams().orderNo} />
}
