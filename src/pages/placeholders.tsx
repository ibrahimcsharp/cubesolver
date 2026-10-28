import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'

export function NotFoundPage() {
  return (
    <section className="space-y-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className={buttonVariants()}>
        Back to home
      </Link>
    </section>
  )
}
