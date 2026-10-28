/**
 * Reads the 9 stickers inside a square box of an image.
 * Works on plain RGBA pixel arrays so it runs the same in the browser, in a
 * Web Worker, and in tests.
 */
import { rgbToLab, type Lab, type RGB } from './color'

export type Pixels = {
  data: Uint8ClampedArray
  width: number
  height: number
}

/** A square region in image pixels. */
export type Box = { x: number; y: number; size: number }

export type StickerSample = {
  rgb: RGB
  lab: Lab
  /** 0 (very mixed colors) to 1 (one even color): is there really a sticker here? */
  evenness: number
  /** Share of pixels that are blown-out white (glare). */
  glare: number
}

export type FaceSample = {
  stickers: StickerSample[]
  /** Average brightness 0-255 of the sampled areas. */
  brightness: number
  /** True when the 9 areas each look like one even color. */
  looksLikeFace: boolean
  glare: boolean
  tooDark: boolean
}

/** Box of the given share of the shorter side, centered in the image. */
export function centeredBox(width: number, height: number, share = 0.6): Box {
  const size = Math.round(Math.min(width, height) * share)
  return { x: Math.round((width - size) / 2), y: Math.round((height - size) / 2), size }
}

const GLARE_LEVEL = 245

function sampleCell(img: Pixels, x0: number, y0: number, cell: number): StickerSample {
  // Use the middle half of each cell, away from the black gaps between stickers.
  const inset = cell * 0.25
  const xs = Math.max(0, Math.floor(x0 + inset))
  const ys = Math.max(0, Math.floor(y0 + inset))
  const xe = Math.min(img.width, Math.ceil(x0 + cell - inset))
  const ye = Math.min(img.height, Math.ceil(y0 + cell - inset))
  const step = Math.max(1, Math.floor((xe - xs) / 12)) // about 12x12 samples per cell

  const pixels: RGB[] = []
  let glare = 0
  for (let y = ys; y < ye; y += step) {
    for (let x = xs; x < xe; x += step) {
      const i = (y * img.width + x) * 4
      const p: RGB = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!]
      if (p[0] >= GLARE_LEVEL && p[1] >= GLARE_LEVEL && p[2] >= GLARE_LEVEL) glare++
      pixels.push(p)
    }
  }
  if (pixels.length === 0) {
    return { rgb: [0, 0, 0], lab: rgbToLab([0, 0, 0]), evenness: 0, glare: 0 }
  }

  // Drop the brightest and darkest 15% (glare spots, shadows, dirt), then average.
  const bright = (p: RGB) => p[0] + p[1] + p[2]
  const sorted = [...pixels].sort((a, b) => bright(a) - bright(b))
  const cut = Math.floor(sorted.length * 0.15)
  const kept = sorted.slice(cut, sorted.length - cut || undefined)
  const avg = [0, 1, 2].map(
    (k) => kept.reduce((s, p) => s + p[k]!, 0) / kept.length,
  ) as unknown as RGB

  // Evenness: how close the kept pixels are to their average.
  const spread =
    kept.reduce(
      (s, p) => s + Math.abs(p[0] - avg[0]) + Math.abs(p[1] - avg[1]) + Math.abs(p[2] - avg[2]),
      0,
    ) /
    kept.length /
    3
  const evenness = Math.max(0, 1 - spread / 40)

  return { rgb: avg, lab: rgbToLab(avg), evenness, glare: glare / pixels.length }
}

/** Samples the 3x3 grid of stickers inside `box`, row by row, as seen in the image. */
export function sampleFace(img: Pixels, box: Box): FaceSample {
  const cell = box.size / 3
  const stickers: StickerSample[] = []
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      stickers.push(sampleCell(img, box.x + c * cell, box.y + r * cell, cell))

  const brightness =
    stickers.reduce((s, x) => s + (x.rgb[0] + x.rgb[1] + x.rgb[2]) / 3, 0) / stickers.length
  const glare = stickers.some((s) => s.glare > 0.2)
  const tooDark = brightness < 45
  const looksLikeFace = !tooDark && stickers.every((s) => s.evenness > 0.55)
  return { stickers, brightness, looksLikeFace, glare, tooDark }
}
