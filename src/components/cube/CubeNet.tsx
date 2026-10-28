/**
 * Flat "cross" map of all 54 stickers:
 *
 *        U
 *     L  F  R  B
 *        D
 *
 * Read-only when `onStickerClick` is not given.
 */
import { CENTER_FACELETS, FACES, type Face, type StickerColor } from '@/modules/cube'
import { cn } from '@/lib/utils'
import { EMPTY_FILL, STICKER_FILL } from './colors'

const GRID_POS: Record<Face, { col: number; row: number }> = {
  U: { col: 1, row: 0 },
  L: { col: 0, row: 1 },
  F: { col: 1, row: 1 },
  R: { col: 2, row: 1 },
  B: { col: 3, row: 1 },
  D: { col: 1, row: 2 },
}

const CENTERS = new Set(Object.values(CENTER_FACELETS))

const HIGHLIGHT_CLASS = {
  error: 'animate-pulse ring-2 ring-fuchsia-500 ring-offset-1 ring-offset-neutral-900',
  check: 'ring-[3px] ring-amber-400 ring-offset-1 ring-offset-neutral-900',
  focus: 'ring-2 ring-sky-400 ring-offset-1 ring-offset-neutral-900',
} as const

type Props = {
  /** 54 sticker colors (null = not set yet) in U R F D L B order. */
  stickers: readonly (StickerColor | null)[]
  /** Optional label per face, e.g. "Top". */
  faceLabels?: Partial<Record<Face, string>>
  highlight?: ReadonlySet<number>
  /** "error" pulses (problem stickers); "check" = please double-check; "focus" = face to turn. */
  highlightTone?: keyof typeof HIGHLIGHT_CLASS
  onStickerClick?: (index: number) => void
  /** Called while dragging across stickers with the mouse held down. */
  onStickerDrag?: (index: number) => void
  lockCenters?: boolean
  className?: string
  label: string
}

export function CubeNet({
  stickers,
  faceLabels,
  highlight,
  highlightTone = 'error',
  onStickerClick,
  onStickerDrag,
  lockCenters = true,
  className,
  label,
}: Props) {
  const interactive = !!onStickerClick
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid w-full grid-cols-4 gap-1.5 sm:gap-2', className)}
    >
      {FACES.map((face) => {
        const pos = GRID_POS[face]
        return (
          <div
            key={face}
            style={{ gridColumn: pos.col + 1, gridRow: pos.row + 1 }}
            className="flex flex-col gap-1"
          >
            <div
              className="grid aspect-square grid-cols-3 gap-[3px] rounded-md bg-neutral-900 p-[3px] sm:gap-1 sm:p-1"
              aria-label={faceLabels?.[face] ?? `Face ${face}`}
              role="group"
            >
              {Array.from({ length: 9 }, (_, i) => {
                const index = FACES.indexOf(face) * 9 + i
                const color = stickers[index] ?? null
                const locked = lockCenters && CENTERS.has(index)
                const common = cn(
                  'aspect-square rounded-[3px] sm:rounded-sm',
                  highlight?.has(index) && HIGHLIGHT_CLASS[highlightTone],
                  color === null && 'border border-dashed border-neutral-500',
                )
                const style = { background: color ? STICKER_FILL[color] : EMPTY_FILL }
                if (!interactive || locked) {
                  return (
                    <div
                      key={i}
                      className={common}
                      style={style}
                      aria-label={locked ? `${color} center (fixed)` : undefined}
                    />
                  )
                }
                return (
                  <button
                    key={i}
                    type="button"
                    className={cn(
                      common,
                      'focus-visible:outline-ring cursor-pointer transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-1',
                    )}
                    style={style}
                    aria-label={`${faceLabels?.[face] ?? face} sticker ${i + 1}: ${color ?? 'not set'}`}
                    onClick={() => onStickerClick(index)}
                    onMouseEnter={(e) => {
                      if (e.buttons === 1) onStickerDrag?.(index)
                    }}
                  />
                )
              })}
            </div>
            {faceLabels?.[face] && (
              <span className="text-muted-foreground text-center text-[11px] leading-tight sm:text-xs">
                {faceLabels[face]}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
