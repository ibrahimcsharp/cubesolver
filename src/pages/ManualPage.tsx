import { AlertTriangle, Eraser, Shuffle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { capitalize, COLOR_KEYS, PICKER_ORDER, STICKER_FILL } from '@/components/cube/colors'
import { CubeNet } from '@/components/cube/CubeNet'
import { Button } from '@/components/ui/button'
import {
  randomCube,
  STANDARD_CENTERS,
  toFacelets,
  validateColors,
  type Face,
  type StickerColor,
  type ValidationError,
} from '@/modules/cube'
import { cn } from '@/lib/utils'
import { useCubeStore } from '@/store/cubeStore'

const FACE_LABELS: Record<Face, string> = {
  U: 'Top',
  L: 'Left',
  F: 'Front',
  R: 'Right',
  B: 'Back',
  D: 'Bottom',
}

export function ManualPage() {
  const navigate = useNavigate()
  const { stickers, setSticker, setAll, clear, setCube } = useCubeStore()
  const [color, setColor] = useState<StickerColor>('white')
  const [errors, setErrors] = useState<ValidationError[]>([])

  const counts = useMemo(() => {
    const c = Object.fromEntries(PICKER_ORDER.map((k) => [k, 0])) as Record<StickerColor, number>
    for (const s of stickers) if (s) c[s]++
    return c
  }, [stickers])
  const unset = stickers.filter((s) => s === null).length
  const highlight = useMemo(() => new Set(errors.flatMap((e) => e.stickers)), [errors])

  // Number keys 1-6 pick a color.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const picked = PICKER_ORDER.find((c) => COLOR_KEYS[c] === e.key)
      if (picked) setColor(picked)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paint = (index: number) => {
    setSticker(index, color)
    setErrors([])
  }

  const tryRandom = () => {
    setAll([...toFacelets(randomCube())].map((ch) => STANDARD_CENTERS[ch as Face]))
    setErrors([])
  }

  const checkAndSolve = () => {
    if (unset > 0) return
    const result = validateColors(stickers as StickerColor[])
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setCube(result)
    navigate('/solution')
  }

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
        <section className="space-y-4">
          <div role="radiogroup" aria-label="Paint color" className="flex flex-wrap gap-2">
            {PICKER_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  'bg-card flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                  color === c ? 'border-primary ring-primary ring-2' : 'hover:bg-muted',
                )}
              >
                <span
                  className="size-5 rounded-sm border border-black/20"
                  style={{ background: STICKER_FILL[c] }}
                  aria-hidden
                />
                <span>{capitalize(c)}</span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    counts[c] > 9 ? 'font-semibold text-red-500' : 'text-muted-foreground',
                    counts[c] === 9 && 'text-primary',
                  )}
                >
                  {counts[c]}/9
                </span>
                <kbd className="text-muted-foreground hidden text-[10px] sm:inline">
                  {COLOR_KEYS[c]}
                </kbd>
              </button>
            ))}
          </div>

          <div className="mx-auto max-w-xl">
            <CubeNet
              label="Cube map: click a sticker to paint it"
              stickers={stickers}
              faceLabels={FACE_LABELS}
              highlight={highlight}
              onStickerClick={paint}
              onStickerDrag={paint}
            />
          </div>

          {errors.length > 0 && (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm"
            >
              <p className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="size-4 text-red-500" aria-hidden />
                This doesn't look like a real cube yet
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {errors.map((e) => (
                  <li key={e.code + e.message}>{e.message}</li>
                ))}
              </ul>
              {highlight.size > 0 && (
                <p className="text-muted-foreground">The stickers to check are flashing.</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button size="lg" onClick={checkAndSolve} disabled={unset > 0}>
              <Sparkles className="size-4" aria-hidden />
              Check & solve
            </Button>
            <Button variant="outline" onClick={tryRandom}>
              <Shuffle className="size-4" aria-hidden />
              Try a random cube
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clear()
                setErrors([])
              }}
            >
              <Eraser className="size-4" aria-hidden />
              Clear
            </Button>
            <span className="text-muted-foreground text-sm" aria-live="polite">
              {unset > 0 ? `${unset} stickers left to fill` : 'All stickers filled'}
            </span>
          </div>
        </section>

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
