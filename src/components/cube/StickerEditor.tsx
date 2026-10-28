/**
 * Color picker + clickable cube map + "Check & solve". Shared by the
 * Enter-by-hand screen and the Check & Correct screen after a scan.
 */
import { AlertTriangle, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { capitalize, COLOR_KEYS, PICKER_ORDER, STICKER_FILL } from '@/components/cube/colors'
import { CubeNet } from '@/components/cube/CubeNet'
import { Button } from '@/components/ui/button'
import { validateColors, type StickerColor, type ValidationError } from '@/modules/cube'
import { cn } from '@/lib/utils'
import { useCubeStore } from '@/store/cubeStore'
import { FACE_LABELS } from './labels'

type Props = {
  /** Stickers to mark for checking (e.g. ones the camera wasn't sure about). */
  toCheck?: ReadonlySet<number>
  /** Called after the user paints a sticker. */
  onPaint?: (index: number) => void
  /** Extra buttons next to "Check & solve". */
  actions?: ReactNode
}

export function StickerEditor({ toCheck, onPaint, actions }: Props) {
  const navigate = useNavigate()
  const { stickers, setSticker, setCube } = useCubeStore()
  const [color, setColor] = useState<StickerColor>('white')
  // Problems found by the last check, for the stickers as they were then.
  // Any change to the stickers (paint, random, clear) hides them.
  const [checked, setChecked] = useState<{ for: unknown; errors: ValidationError[] } | null>(null)
  const errors = useMemo(
    () => (checked?.for === stickers ? checked.errors : []),
    [checked, stickers],
  )

  const counts = useMemo(() => {
    const c = Object.fromEntries(PICKER_ORDER.map((k) => [k, 0])) as Record<StickerColor, number>
    for (const s of stickers) if (s) c[s]++
    return c
  }, [stickers])
  const unset = stickers.filter((s) => s === null).length
  const errorStickers = useMemo(() => new Set(errors.flatMap((e) => e.stickers)), [errors])

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
    onPaint?.(index)
  }

  const checkAndSolve = () => {
    if (unset > 0) return
    const result = validateColors(stickers as StickerColor[])
    if (!result.ok) {
      setChecked({ for: stickers, errors: result.errors })
      return
    }
    setCube(result)
    navigate('/solution')
  }

  const showErrors = errorStickers.size > 0

  return (
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
          highlight={showErrors ? errorStickers : toCheck}
          highlightTone={showErrors ? 'error' : 'check'}
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
          {errorStickers.size > 0 && (
            <p className="text-muted-foreground">The stickers to check are flashing.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={checkAndSolve} disabled={unset > 0}>
          <Sparkles className="size-4" aria-hidden />
          Check & solve
        </Button>
        {actions}
        <span className="text-muted-foreground text-sm" aria-live="polite">
          {unset > 0 ? `${unset} stickers left to fill` : 'All stickers filled'}
        </span>
      </div>
    </section>
  )
}
