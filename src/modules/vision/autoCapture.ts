/**
 * Decides when to save a side automatically during a video scan.
 *
 * Feed it one sampled frame at a time. It says "capture" once:
 *   - the box shows one side of the cube, not too dark, no glare,
 *   - the colors have stayed steady for `steadyMs`,
 *   - the middle sticker looks like the side this step needs, and
 *   - it is not the side that was just captured.
 * Works the same for the live webcam and for an uploaded video.
 */
import type { StickerColor } from '@/modules/cube'
import {
  colorDistance,
  linearToLab,
  luminance,
  NOMINAL_RGB,
  rgbToLab,
  toLinear,
  type Lab,
  type RGB,
} from './color'
import type { FaceSample } from './sample'

export type AutoCaptureStatus =
  | 'no-face'
  | 'too-dark'
  | 'glare'
  | 'moving'
  | 'wrong-side'
  | 'same-as-last'
  | 'steadying'
  | 'capture'

export type AutoCaptureResult = {
  status: AutoCaptureStatus
  /** 0-1 while holding steady, for a progress ring. */
  progress: number
}

export type AutoCaptureOptions = {
  /** How long the colors must stay steady before capturing. */
  steadyMs: number
  /** Largest color change from the start of the still period that still counts as steady. */
  maxChange: number
  /** Smallest average color change from the last capture to count as a new side. */
  minChangeFromLast: number
}

export const DEFAULT_AUTO_CAPTURE: AutoCaptureOptions = {
  steadyMs: 600,
  maxChange: 18,
  minChangeFromLast: 14,
}

const NOMINAL_LAB = Object.entries(NOMINAL_RGB).map(
  ([color, rgb]) => [color as StickerColor, rgbToLab(rgb)] as const,
)

/** If the expected color is at most this much farther than the closest one, accept it. */
const CLOSE_CALL = 1.3

/**
 * Is this middle sticker the color we expect? Accepts it when:
 *  - the expected color is the closest standard color, or
 *  - it is nearly as close as the closest one (lighting makes e.g. blue look
 *    a bit like white), or
 *  - it is second closest and the closest belongs to a side already scanned.
 */
export function centerMatches(
  lab: Lab,
  expected: StickerColor,
  alreadyScanned: readonly StickerColor[],
): boolean {
  const ranked = [...NOMINAL_LAB]
    .map(([c, ref]) => ({ c, d: colorDistance(lab, ref) }))
    .sort((a, b) => a.d - b.d)
  const best = ranked[0]!
  if (best.c === expected) return true
  const exp = ranked.find((r) => r.c === expected)!
  if (exp.d <= best.d * CLOSE_CALL) return true
  return ranked[1]!.c === expected && alreadyScanned.includes(best.c)
}

/**
 * Light correction learned from the middle stickers captured so far: their
 * colors are known, so how they look tells us how the room light shifts
 * colors. Each channel is trusted in proportion to how much of that sticker's
 * light it carries; the rest falls back to plain brightness.
 */
export function learnedGains(centers: readonly { color: StickerColor; seen: RGB }[]): RGB {
  if (centers.length === 0) return [1, 1, 1]
  const logs = [0, 1, 2].map((ch) => {
    let sum = 0
    for (const { color, seen } of centers) {
      const nominal = toLinear(NOMINAL_RGB[color])
      const share = nominal[ch]! / (nominal[0]! + nominal[1]! + nominal[2]!)
      const exposure = luminance(nominal) / Math.max(1e-4, luminance(seen))
      const channel = nominal[ch]! / Math.max(1e-4, seen[ch]!)
      sum += share * Math.log(channel) + (1 - share) * Math.log(exposure)
    }
    return sum / centers.length
  })
  return logs.map((l) => Math.min(4, Math.max(0.25, Math.exp(l)))) as unknown as RGB
}

export class AutoCapture {
  private steadySince: number | null = null
  /** Colors at the start of the current still period. */
  private anchor: Lab[] | null = null
  private lastCaptured: Lab[] | null = null
  /** Middle stickers of captured sides (linear light), to learn the room light. */
  private centers: { color: StickerColor; seen: RGB }[] = []
  private readonly opts: AutoCaptureOptions

  constructor(opts: Partial<AutoCaptureOptions> = {}) {
    this.opts = { ...DEFAULT_AUTO_CAPTURE, ...opts }
  }

  /** Start over (e.g. a new scan). */
  reset(): void {
    this.steadySince = null
    this.anchor = null
    this.lastCaptured = null
    this.centers = []
  }

  /** Forget one side (the user is retaking it). */
  forget(color: StickerColor): void {
    this.centers = this.centers.filter((c) => c.color !== color)
    this.lastCaptured = null
  }

  /**
   * @param sample the 9 stickers read from this frame
   * @param timeMs time of the frame
   * @param expected the side this step needs facing the camera
   * @param alreadyScanned center colors of sides captured so far
   */
  push(
    sample: FaceSample,
    timeMs: number,
    expected: StickerColor,
    alreadyScanned: readonly StickerColor[],
  ): AutoCaptureResult {
    const labs = sample.stickers.map((s) => s.lab)

    const notReady: AutoCaptureStatus | null = sample.tooDark
      ? 'too-dark'
      : sample.glare
        ? 'glare'
        : !sample.looksLikeFace
          ? 'no-face'
          : null
    if (notReady) {
      this.steadySince = null
      this.anchor = null
      return { status: notReady, progress: 0 }
    }

    // Compare with the start of the still period (not just the last frame),
    // so camera noise doesn't reset it but a slow drift does.
    const anchor = this.anchor
    const change = anchor ? Math.max(...labs.map((l, i) => colorDistance(l, anchor[i]!))) : Infinity
    if (change > this.opts.maxChange) {
      this.anchor = labs
      this.steadySince = timeMs
      return { status: 'moving', progress: 0 }
    }
    this.steadySince ??= timeMs

    const gains = learnedGains(this.centers)
    const center = toLinear(sample.stickers[4]!.rgb).map(
      (v, ch) => v * gains[ch]!,
    ) as unknown as RGB
    if (!centerMatches(linearToLab(center), expected, alreadyScanned)) {
      return { status: 'wrong-side', progress: 0 }
    }
    if (this.lastCaptured) {
      const last = this.lastCaptured
      const avg = labs.reduce((s, l, i) => s + colorDistance(l, last[i]!), 0) / labs.length
      if (avg < this.opts.minChangeFromLast) return { status: 'same-as-last', progress: 0 }
    }

    const progress = Math.min(1, (timeMs - this.steadySince) / this.opts.steadyMs)
    if (progress < 1) return { status: 'steadying', progress }

    this.lastCaptured = labs
    this.centers = [
      ...this.centers.filter((c) => c.color !== expected),
      { color: expected, seen: toLinear(sample.stickers[4]!.rgb) },
    ]
    this.steadySince = null
    this.anchor = null
    return { status: 'capture', progress: 1 }
  }
}

/** Plain-English hint for each status, shown under the camera view. */
export const AUTO_CAPTURE_HINT: Record<AutoCaptureStatus, string> = {
  'no-face': 'Fill the box with one side of the cube.',
  'too-dark': 'Too dark. Turn on a light or face a window.',
  glare: 'Glare on the stickers. Tilt the cube a little.',
  moving: 'Hold still…',
  'wrong-side': 'Show the side this step asks for.',
  'same-as-last': 'Now turn to the next side.',
  steadying: 'Hold still…',
  capture: 'Got it!',
}
