import { Eraser, Shuffle } from 'lucide-react'
import { StickerEditor } from '@/components/cube/StickerEditor'
import { Button } from '@/components/ui/button'
import { randomCube, STANDARD_CENTERS, toFacelets, type Face } from '@/modules/cube'
import { useCubeStore } from '@/store/cubeStore'

export function ManualPage() {
  const { setAll, clear } = useCubeStore()

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Enter your cube by hand</h1>
        <p className="text-muted-foreground max-w-2xl text-sm">
          Pick a color, then click the stickers to paint them. You can also drag across several
          stickers. The center of each face is fixed.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <StickerEditor
          actions={
            <>
              <Button
                variant="outline"
                onClick={() =>
                  setAll([...toFacelets(randomCube())].map((ch) => STANDARD_CENTERS[ch as Face]))
                }
              >
                <Shuffle className="size-4" aria-hidden />
                Try a random cube
              </Button>
              <Button variant="ghost" onClick={clear}>
                <Eraser className="size-4" aria-hidden />
                Clear
              </Button>
            </>
          }
        />

        <aside className="bg-card h-fit space-y-3 rounded-xl border p-5 text-sm">
          <h2 className="font-semibold">How to read your cube</h2>
          <p>
            Hold the cube with <strong>white on top</strong> and <strong>green facing you</strong>.
          </p>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground">Front, Right, Back, Left:</strong> look at each
              side straight on, with white still on top. Turn the whole cube to the left to go from
              one side to the next.
            </li>
            <li>
              <strong className="text-foreground">Top:</strong> tip the cube toward you so you see
              the white face. The row next to green goes at the bottom of the top face on the map.
            </li>
            <li>
              <strong className="text-foreground">Bottom:</strong> tip the cube away from you so you
              see the yellow face. The row next to green goes at the top of the bottom face on the
              map.
            </li>
          </ul>
          <p className="text-muted-foreground">Tip: press 1–6 to switch colors quickly.</p>
        </aside>
      </div>
    </div>
  )
}
