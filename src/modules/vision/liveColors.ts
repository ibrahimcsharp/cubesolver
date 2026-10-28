/**
 * Best guess of each sticker's color while scanning, for the colored dots
 * over the camera picture. Compares color tint (not brightness), and learns
 * what each color really looks like in this room from the sides captured so
 * far: a captured side's middle sticker shows its color in this light.
 */
import { COLORS, type StickerColor } from '@/modules/cube'
import { NOMINAL_RGB, toLinear, type RGB } from './color'
import { assign } from './hungarian'

type Chroma = [number, number]

/** Tint of a color without its brightness. */
function chroma(rgb: RGB): Chroma {
  const [r, g, b] = toLinear(rgb)
  const s = r + g + b || 1e-6
  return [r / s, g / s]
}

const NOMINAL: Record<StickerColor, Chroma> = Object.fromEntries(
  COLORS.map((c) => [c, chroma(NOMINAL_RGB[c])]),
) as Record<StickerColor, Chroma>

const dist = (a: Chroma, b: Chroma) => Math.hypot(a[0] - b[0], a[1] - b[1])

export class LiveColors {
  private refs: Record<StickerColor, Chroma> = { ...NOMINAL }

  /** Start over with standard colors. */
  reset(): void {
    this.refs = { ...NOMINAL }
  }

  /**
   * Learn from the middle stickers captured so far. They must all be
   * different colors, so they are matched to colors all at once.
   */
  learn(centers: readonly RGB[]): StickerColor[] {
    this.refs = { ...NOMINAL }
    if (centers.length === 0) return []
    const seen = centers.map(chroma)
    // Hungarian needs a square table: pad with "nobody" rows that cost nothing.
    const cost = COLORS.map((_, r) =>
      r < seen.length ? COLORS.map((c) => dist(seen[r]!, NOMINAL[c])) : COLORS.map(() => 0),
    )
    const match = assign(cost)
    seen.forEach((ch, r) => (this.refs[COLORS[match[r]!]!] = ch))
    // Which color each center was matched to.
    return seen.map((_, r) => COLORS[match[r]!]!)
  }

  /** The most likely color for this sticker. */
  guess(rgb: RGB): StickerColor {
    const ch = chroma(rgb)
    // Very dark or very grey stickers carry little tint; brightness decides white.
    let best: StickerColor = 'white'
    let bestD = Infinity
    for (const c of COLORS) {
      const d = dist(ch, this.refs[c])
      if (d < bestD) {
        bestD = d
        best = c
      }
    }
    return best
  }
}
