import { Link } from 'react-router'
import { ComingSoon } from '@/components/ComingSoon'
import { buttonVariants } from '@/components/ui/button-variants'

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

export function CheckPage() {
  return (
    <ComingSoon title="Check your scan" phase={3}>
      Review all 54 stickers and fix any the camera misread.
    </ComingSoon>
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
