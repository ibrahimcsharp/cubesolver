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
  /** Average difference of the pixels from their average color (camera grain + mixing). */
  spread: number
  /** Biggest color difference between the area's left/right or top/bottom halves. */
  halfDiff: number
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
  /** Nearly black: nothing can be read. */
  tooDark: boolean
  /** Readable, but more light would help. */
  dim: boolean
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
  // Sums for the left/right and top/bottom halves (glare left out).
  const half = { l: [0, 0, 0, 0], r: [0, 0, 0, 0], t: [0, 0, 0, 0], b: [0, 0, 0, 0] }
  const midX = (xs + xe) / 2
  const midY = (ys + ye) / 2
  const addTo = (h: number[], p: RGB) => {
    h[0]! += p[0]
    h[1]! += p[1]
    h[2]! += p[2]
    h[3]!++
  }
  for (let y = ys; y < ye; y += step) {
    for (let x = xs; x < xe; x += step) {
      const i = (y * img.width + x) * 4
      const p: RGB = [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!]
      if (p[0] >= GLARE_LEVEL && p[1] >= GLARE_LEVEL && p[2] >= GLARE_LEVEL) glare++
      else {
        addTo(x < midX ? half.l : half.r, p)
        addTo(y < midY ? half.t : half.b, p)
      }
      pixels.push(p)
    }
  }
  const diff = (a: number[], b: number[]) =>
    a[3]! && b[3]!
      ? [0, 1, 2].reduce((s, k) => s + Math.abs(a[k]! / a[3]! - b[k]! / b[3]!), 0) / 3
      : 0
  const halfDiff = Math.max(diff(half.l, half.r), diff(half.t, half.b))
  if (pixels.length === 0) {
    return {
      rgb: [0, 0, 0],
      lab: rgbToLab([0, 0, 0]),
      evenness: 0,
      spread: 99,
      halfDiff: 99,
      glare: 0,
    }
  }

  // Drop the brightest and darkest 15% (glare spots, shadows, dirt), then average.
  const bright = (p: RGB) => p[0] + p[1] + p[2]
  // Glare pixels say nothing about the sticker's color; leave them out (unless that's all there is).
  const usable = pixels.filter(
    (p) => !(p[0] >= GLARE_LEVEL && p[1] >= GLARE_LEVEL && p[2] >= GLARE_LEVEL),
  )
  const sorted = (usable.length >= pixels.length / 3 ? usable : pixels).sort(
    (a, b) => bright(a) - bright(b),
  )
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

  return { rgb: avg, lab: rgbToLab(avg), evenness, spread, halfDiff, glare: glare / pixels.length }
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
  // Webcams brighten dark scenes themselves, so even a dim picture can usually
  // be read. Only a nearly black one can't.
  const tooDark = brightness < 18
  const dim = !tooDark && brightness < 60
  // Each area must be one even color. "Even" is judged against this picture's
  // own grain: in low light every area is grainy, but a cell that spans two
  // stickers (the cube moving, or not in the box) is much less even than the rest.
  const spreads = stickers.map((s) => s.spread).sort((a, b) => a - b)
  const typical = spreads[4]!
  // Averaging half an area cancels most grain, so a clear difference between
  // its halves means it spans two stickers.
  const looksLikeFace =
    !tooDark &&
    typical < 30 &&
    stickers.every((s) => s.spread < Math.max(18, typical * 1.8) && s.halfDiff < 9)
  return { stickers, brightness, looksLikeFace, glare, tooDark, dim }
}
