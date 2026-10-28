import { Construction } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  title: string
  phase: number
  children?: ReactNode
}

/** Placeholder for screens that are built in later phases. */
export function ComingSoon({ title, phase, children }: Props) {
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="bg-card flex items-start gap-3 rounded-xl border p-5">
        <Construction className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="space-y-2 text-sm">
          <p className="font-medium">Coming in Phase {phase}</p>
          {children && <div className="text-muted-foreground">{children}</div>}
        </div>
      </div>
    </section>
  )
}
