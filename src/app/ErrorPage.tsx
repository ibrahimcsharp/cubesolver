import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'

/** Shown instead of a blank screen if a page crashes. */
export function ErrorPage() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error)
  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
      <AlertTriangle className="mx-auto size-10 text-amber-500" aria-hidden />
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Sorry, this page hit a problem. Your cube is saved, so you can go back and try again.
      </p>
      <p className="text-muted-foreground font-mono text-xs">{detail}</p>
      <Link to="/" reloadDocument className={buttonVariants()}>
        Back to home
      </Link>
    </main>
  )
}
