/**
 * Draws fake cube-face photos for tests: stickers with black gaps on a noisy
 * background, with lighting tint, uneven light, glare and camera noise.
 * Not a replacement for real photos (see test-data/README.md), but it lets
 * us measure the color reader under controlled, repeatable conditions.
 */
import type { StickerColor } from '@/modules/cube'
import type { RGB } from './color'
import type { Box, Pixels } from './sample'

/** Sticker colors roughly as a webcam records them in neutral light. */
export const CAMERA_RGB: Record<StickerColor, RGB> = {
  white: [215, 218, 214],
  yellow: [222, 200, 45],
  green: [35, 150, 85],
  blue: [30, 75, 170],
  red: [165, 30, 42],
  orange: [232, 100, 32],
}

export type Lighting = {
  name: string
  /** Multiplies R, G, B (e.g. warm bulb = more red, less blue). */
  tint: RGB
  /** Overall brightness multiplier. */
  level: number
  /** Brightness change from left to right edge (0 = even). */
  gradient: number
  /** Add a glare spot on one sticker. */
  glare: boolean
}

export const LIGHTINGS: readonly Lighting[] = [
  { name: 'daylight', tint: [1, 1, 1], level: 1, gradient: 0, glare: false },
  { name: 'warm bulb', tint: [1.12, 1, 0.72], level: 0.95, gradient: 0.15, glare: false },
  { name: 'cool LED', tint: [0.9, 1, 1.15], level: 1, gradient: 0.1, glare: false },
  { name: 'dim room', tint: [1, 1, 1], level: 0.5, gradient: 0.2, glare: false },
  { name: 'side lamp', tint: [1.05, 1, 0.9], level: 0.9, gradient: 0.45, glare: false },
  { name: 'glare', tint: [1, 1, 1], level: 1, gradient: 0.1, glare: true },
]

/** Deliberately harsh conditions, to find the limits. */
export const HARSH_LIGHTINGS: readonly Lighting[] = [
  { name: 'very warm', tint: [1.25, 0.95, 0.55], level: 0.8, gradient: 0.25, glare: false },
  { name: 'dark corner', tint: [1, 1, 1], level: 0.3, gradient: 0.4, glare: false },
  { name: 'warm + glare', tint: [1.18, 0.98, 0.65], level: 0.7, gradient: 0.35, glare: true },
]

export type FaceImageOptions = {
  width: number
  height: number
  box: Box
  /** 9 sticker colors as seen by the camera, row by row. */
  colors: readonly StickerColor[]
  lighting: Lighting
  rand: () => number
  /** Per-cube sticker color offset (different plastic / camera). */
  cubeShift?: Partial<Record<StickerColor, RGB>>
  /** Fixed color offset per sticker (keep the same across video frames). Random if left out. */
  stickerShift?: readonly RGB[]
}

const clamp = (v: number) => Math.max(0, Math.min(255, v))

export function makeFaceImage(o: FaceImageOptions): Pixels {
  const { width, height, box, lighting, rand } = o
  const data = new Uint8ClampedArray(width * height * 4)
  const noise = (amp: number) => (rand() + rand() + rand() - 1.5) * amp
  const bg: RGB = [80 + rand() * 120, 80 + rand() * 120, 80 + rand() * 120]
  const cell = box.size / 3
  const gapW = cell * 0.08
  const border = cell * 0.08
  const stickerShift = o.stickerShift ?? o.colors.map(() => [noise(10), noise(10), noise(10)])
  const glareCell = Math.floor(rand() * 9)
  const glareR = cell * 0.18

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rgb: number[]
      const inBody =
        x >= box.x - border &&
        x < box.x + box.size + border &&
        y >= box.y - border &&
        y < box.y + box.size + border
      if (!inBody) {
        rgb = [bg[0] + noise(25), bg[1] + noise(25), bg[2] + noise(25)]
      } else {
        const cx = (x - box.x) / cell
        const cy = (y - box.y) / cell
        const c = Math.floor(cx)
        const r = Math.floor(cy)
        const fx = (cx - c) * cell
        const fy = (cy - r) * cell
        const onSticker =
          c >= 0 &&
          c < 3 &&
          r >= 0 &&
          r < 3 &&
          fx > gapW &&
          fx < cell - gapW &&
          fy > gapW &&
          fy < cell - gapW
        if (!onSticker) {
          rgb = [20, 20, 22] // black plastic
        } else {
          const i = r * 3 + c
          const color = o.colors[i]!
          const base = CAMERA_RGB[color]
          const shift = o.cubeShift?.[color] ?? [0, 0, 0]
          rgb = [0, 1, 2].map((k) => base[k]! + shift[k]! + stickerShift[i]![k]!)
          if (lighting.glare && i === glareCell) {
            const gx = box.x + (c + 0.35) * cell
            const gy = box.y + (r + 0.35) * cell
            if ((x - gx) ** 2 + (y - gy) ** 2 < glareR ** 2) rgb = [255, 255, 255]
          }
        }
      }
      const light = lighting.level * (1 + lighting.gradient * (x / width - 0.5) * 2)
      const idx = (y * width + x) * 4
      for (let k = 0; k < 3; k++) {
        const isGlare = rgb[0] === 255 && rgb[1] === 255 && rgb[2] === 255
        data[idx + k] = isGlare ? 255 : clamp(rgb[k]! * lighting.tint[k]! * light + noise(12))
      }
      data[idx + 3] = 255
    }
  }
  return { data, width, height }
}
