import { Camera, Grid3x3, Upload } from 'lucide-react'
import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'
import { cn } from '@/lib/utils'

const options = [
  {
    to: '/scan',
    icon: Camera,
    title: 'Scan my cube',
    text: 'Show each face to your webcam, as photos or live video.',
    primary: true,
  },
  {
    to: '/upload',
    icon: Upload,
    title: 'Upload photos or video',
    text: 'Use 6 photos or a short video taken with any camera.',
  },
  {
    to: '/manual',
    icon: Grid3x3,
    title: 'Enter colors by hand',
    text: 'Click each of the 54 stickers and choose its color.',
  },
]

export function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-3 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">Solve your Rubik's cube, step by step</h1>
        <p className="text-muted-foreground mx-auto max-w-xl">
          Scan your cube with your webcam. Get a short solution or an easy beginner guide, follow
          along live, or download it as a PDF or video.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Choose how to enter your cube">
        {options.map(({ to, icon: Icon, title, text, primary }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'bg-card flex flex-col gap-3 rounded-xl border p-5 transition-shadow hover:shadow-md',
              primary && 'border-primary',
            )}
          >
            <Icon className="text-primary size-7" aria-hidden />
            <span className="font-semibold">{title}</span>
            <span className="text-muted-foreground text-sm">{text}</span>
          </Link>
        ))}
      </section>

      <section className="text-center">
        <Link to="/notation" className={buttonVariants({ variant: 'outline' })}>
          New to cubing? Learn the move notation
        </Link>
      </section>
    </div>
  )
}
