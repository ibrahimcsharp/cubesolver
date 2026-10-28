/**
 * Color math for reading stickers. LAB color space separates brightness (L)
 * from color (a = green↔red, b = blue↔yellow), so lighting changes mostly
 * affect L and the sticker colors stay apart.
 */
import type { StickerColor } from '@/modules/cube'

export type RGB = readonly [number, number, number]
export type Lab = readonly [number, number, number]

function linear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** sRGB (0-255) to linear light (0-1), where brightness changes are simple multiplications. */
export function toLinear([r, g, b]: RGB): RGB {
  return [linear(r), linear(g), linear(b)]
}

/** Brightness (relative luminance) of a linear color. */
export function luminance([R, G, B]: RGB): number {
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (t * 24389) / 27 / 116 + 16 / 116)

/** sRGB (0-255) to CIE LAB (D65). */
export function rgbToLab(rgb: RGB): Lab {
  return linearToLab(toLinear(rgb))
}

/** Linear RGB (0-1) to CIE LAB (D65). */
export function linearToLab([R, G, B]: RGB): Lab {
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

/**
 * Distance between two colors. Brightness counts for less than hue, because
 * the same sticker looks darker in shadow but keeps its hue.
 */
export function colorDistance(a: Lab, b: Lab): number {
  const dL = (a[0] - b[0]) * 0.5
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dL * dL + da * da + db * db)
}

/** Typical sticker colors under ordinary indoor light (for live hints only). */
export const NOMINAL_RGB: Record<StickerColor, RGB> = {
  white: [235, 235, 235],
  yellow: [235, 215, 30],
  green: [20, 160, 80],
  blue: [20, 70, 180],
  red: [190, 25, 45],
  orange: [250, 110, 20],
}

const NOMINAL_LAB = Object.fromEntries(
  Object.entries(NOMINAL_RGB).map(([k, v]) => [k, rgbToLab(v)]),
) as Record<StickerColor, Lab>

/** Rough guess of a single sticker's color, used for the live preview. */
export function nearestNominal(lab: Lab): StickerColor {
  let best: StickerColor = 'white'
  let bestD = Infinity
  for (const [color, ref] of Object.entries(NOMINAL_LAB) as [StickerColor, Lab][]) {
    const d = colorDistance(lab, ref)
    if (d < bestD) {
      bestD = d
      best = color
    }
  }
  return best
}
