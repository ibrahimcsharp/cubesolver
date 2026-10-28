import { Camera, Upload } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { capitalize } from '@/components/cube/colors'
import { StickerEditor } from '@/components/cube/StickerEditor'
import { buttonVariants } from '@/components/ui/button-variants'
import { SCAN_ORDER } from '@/modules/cube'
import { useScanStore } from '@/store/scanStore'

export function CheckPage() {
  const { faces, uncertain, source, markChecked } = useScanStore()
  const toCheck = useMemo(() => new Set(uncertain), [uncertain])

  if (!source) {
    return (
      <section className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Nothing to check yet</h1>
        <p className="text-muted-foreground">Scan your cube or upload photos first.</p>
        <div className="flex justify-center gap-2">
          <Link to="/scan" className={buttonVariants()}>
            Scan my cube
          </Link>
          <Link to="/upload" className={buttonVariants({ variant: 'outline' })}>
            Upload photos
          </Link>
        </div>
      </section>
    )
  }

  const again = source === 'scan' ? '/scan' : '/upload'

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Check your scan</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Compare the map with your cube.{' '}
          {uncertain.length > 0 ? (
            <>
              We weren't sure about{' '}
              <strong className="text-foreground">
                {uncertain.length} sticker{uncertain.length === 1 ? '' : 's'}
              </strong>{' '}
              (outlined in amber). Fix any wrong ones by picking a color and clicking the sticker.
            </>
          ) : (
            'Every sticker was read clearly. Fix any that look wrong by picking a color and clicking the sticker.'
          )}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <StickerEditor
          toCheck={toCheck}
          onPaint={markChecked}
          actions={
            <Link to={again} className={buttonVariants({ variant: 'outline' })}>
              {source === 'scan' ? (
                <Camera className="size-4" aria-hidden />
              ) : (
                <Upload className="size-4" aria-hidden />
              )}
              {source === 'scan' ? 'Scan again' : 'Change photos'}
            </Link>
          }
        />

        <aside className="bg-card h-fit space-y-3 rounded-xl border p-5 text-sm">
          <h2 className="font-semibold">What the camera saw</h2>
          <div className="grid grid-cols-3 gap-2">
            {SCAN_ORDER.map((s, i) => (
              <figure key={s.front} className="space-y-1">
                {faces[i] ? (
                  <img
                    src={faces[i]!.thumbnail}
                    alt={`Photo of the ${s.front} side`}
                    className="aspect-square w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="bg-muted aspect-square rounded-md" />
                )}
                <figcaption className="text-muted-foreground text-center text-xs">
                  {capitalize(s.front)}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="text-muted-foreground text-xs">
            These show each side as the camera saw it, with {SCAN_ORDER[0]!.top} on top for the four
            sides.
          </p>
        </aside>
      </div>
    </div>
  )
}
