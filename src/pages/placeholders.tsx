import { Link } from 'react-router'
import { ComingSoon } from '@/components/ComingSoon'
import { buttonVariants } from '@/components/ui/button-variants'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

export function ScanPage() {
  return (
    <ComingSoon title="Scan your cube" phase={3}>
      Webcam scan with a guide box for each of the 6 faces. Live video scan (automatic capture)
      follows in Phase 5.
    </ComingSoon>
  )
}

export function UploadPage() {
  return (
    <ComingSoon title="Upload photos or video" phase={3}>
      Upload 6 face photos. Video upload follows in Phase 5.
    </ComingSoon>
  )
}

export function ManualPage() {
  return (
    <ComingSoon title="Enter colors by hand" phase={2}>
      A flat cube map where you click each of the 54 stickers to set its color.
    </ComingSoon>
  )
}

export function CheckPage() {
  return (
    <ComingSoon title="Check your scan" phase={3}>
      Review all 54 stickers and fix any the camera misread.
    </ComingSoon>
  )
}

export function NotationPage() {
  return (
    <ComingSoon title="Learn the move notation" phase={2}>
      What R, U, F, R′ and R2 mean, with pictures.
    </ComingSoon>
  )
}

export function SolutionPage() {
  const solveStyle = useSettingsStore((s) => s.solveStyle)
  const setSolveStyle = useSettingsStore((s) => s.setSolveStyle)

  return (
    <div className="space-y-6">
      <div
        role="radiogroup"
        aria-label="Solution style"
        className="inline-flex rounded-lg border p-1"
      >
        {(['beginner', 'optimal'] as const).map((style) => (
          <button
            key={style}
            type="button"
            role="radio"
            aria-checked={solveStyle === style}
            onClick={() => setSolveStyle(style)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm',
              solveStyle === style ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {style === 'beginner' ? 'Beginner (Learn)' : 'Optimal (Fast)'}
          </button>
        ))}
      </div>
      <ComingSoon title="Your solution" phase={2}>
        Steps list (Phase 2), 3D player (Phase 4), live guided mode (Phase 6), and PDF / video
        download (Phase 7).
      </ComingSoon>
    </div>
  )
}

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
