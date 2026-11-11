import { createFileRoute } from '@tanstack/react-router'
import { Product } from '@/features/shop/product'

export const Route = createFileRoute('/products/$id')({ component: Page })

function Page() {
  return <Product id={Number(Route.useParams().id)} />
}
