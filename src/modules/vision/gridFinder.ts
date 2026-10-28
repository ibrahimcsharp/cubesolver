/**
 * PROTOTYPE: finds a cube face anywhere in an image, without OpenCV.
 *
 * A cube face is a square of 9 even-colored patches split by darker lines
 * (the plastic between stickers). We shrink the image, then try many square
 * positions and sizes and score each one:
 *   + how much darker the lines between cells are than the cells,
 *   - how uneven the color inside each cell is.
 * Running sums ("integral images") make each check constant-time, so tens of
 * thousands of candidates take a few milliseconds.
 *
 * Used to pre-place the crop box on uploaded photos. Phase 5 builds automatic
 * live capture on top of it.
 */
import type { Box, Pixels } from './sample'

type Integral = { w: number; h: number; sums: Float64Array[] }

const WORK_SIZE = 128

export function downscale(img: Pixels): { px: Pixels; scale: number } {
  const scale = Math.min(1, WORK_SIZE / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Box filter: average the source pixels that fall into this pixel.
      const sx0 = Math.floor(x / scale)
      const sy0 = Math.floor(y / scale)
      const sx1 = Math.min(img.width, Math.floor((x + 1) / scale))
      const sy1 = Math.min(img.height, Math.floor((y + 1) / scale))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let sy = sy0; sy < Math.max(sy1, sy0 + 1); sy += 2)
        for (let sx = sx0; sx < Math.max(sx1, sx0 + 1); sx += 2) {
          const i = (sy * img.width + sx) * 4
          r += img.data[i]!
          g += img.data[i + 1]!
          b += img.data[i + 2]!
          n++
        }
      const o = (y * w + x) * 4
      data[o] = r / n
      data[o + 1] = g / n
      data[o + 2] = b / n
      data[o + 3] = 255
    }
  }
  return { px: { data, width: w, height: h }, scale }
}

/** Running sums of R, G, B, brightness and their squares. */
export function integral(img: Pixels): Integral {
  const w = img.width + 1
  const h = img.height + 1
  const sums = Array.from({ length: 7 }, () => new Float64Array(w * h))
  for (let y = 1; y < h; y++) {
    const row = Array<number>(7).fill(0)
    for (let x = 1; x < w; x++) {
      const i = ((y - 1) * img.width + (x - 1)) * 4
      const r = img.data[i]!
      const g = img.data[i + 1]!
      const b = img.data[i + 2]!
      const vals = [r, g, b, r * r, g * g, b * b, (r + g + b) / 3]
      for (let k = 0; k < 7; k++) {
        row[k]! += vals[k]!
        sums[k]![y * w + x] = sums[k]![(y - 1) * w + x]! + row[k]!
      }
    }
  }
  return { w, h, sums }
}

function rectSum(I: Integral, k: number, x0: number, y0: number, x1: number, y1: number): number {
  const s = I.sums[k]!
  const xa = Math.max(0, Math.min(I.w - 1, Math.round(x0)))
  const ya = Math.max(0, Math.min(I.h - 1, Math.round(y0)))
  const xb = Math.max(0, Math.min(I.w - 1, Math.round(x1)))
  const yb = Math.max(0, Math.min(I.h - 1, Math.round(y1)))
  return s[yb * I.w + xb]! - s[ya * I.w + xb]! - s[yb * I.w + xa]! + s[ya * I.w + xa]!
}

function rectArea(x0: number, y0: number, x1: number, y1: number) {
  return Math.max(1, (Math.round(x1) - Math.round(x0)) * (Math.round(y1) - Math.round(y0)))
}

/** Score of a candidate square; higher is more cube-like. */
export function score(I: Integral, x: number, y: number, s: number): number {
  const cell = s / 3
  const inset = cell * 0.22
  let unevenness = 0
  let cellBright = 0
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x0 = x + c * cell + inset
      const y0 = y + r * cell + inset
      const x1 = x + (c + 1) * cell - inset
      const y1 = y + (r + 1) * cell - inset
      const a = rectArea(x0, y0, x1, y1)
      let variance = 0
      for (let k = 0; k < 3; k++) {
        const m = rectSum(I, k, x0, y0, x1, y1) / a
        variance += rectSum(I, k + 3, x0, y0, x1, y1) / a - m * m
      }
      unevenness += Math.sqrt(Math.max(0, variance / 3))
      cellBright += rectSum(I, 6, x0, y0, x1, y1) / a
    }
  }
  unevenness /= 9
  cellBright /= 9

  // Thin strips on all 8 grid lines: the 4 between stickers and the 4 around
  // the outside (the cube's plastic border). Only the brightest strip counts
  // against us, so a box shifted onto a sticker row scores badly.
  const t = Math.max(1, s * 0.03)
  const strips: number[] = []
  for (const k of [0, 1, 2, 3]) {
    const lx = x + k * cell
    const ly = y + k * cell
    strips.push(rectSum(I, 6, lx - t, y, lx + t, y + s) / rectArea(lx - t, y, lx + t, y + s))
    strips.push(rectSum(I, 6, x, ly - t, x + s, ly + t) / rectArea(x, ly - t, x + s, ly + t))
  }
  const lineBright = strips.reduce((a, b) => a + b, 0) / strips.length
  const worstLine = Math.max(...strips)

  // Judged relative to the picture's brightness, so dim pictures score like bright ones.
  const level = Math.max(30, cellBright)
  const gap = (cellBright - (lineBright + worstLine) / 2) / level
  return gap * 2 - (unevenness / level) * 3
}

export type FoundFace = { box: Box; score: number }

/**
 * Best cube-face square in the image, or null if nothing looks like one.
 * The box is in the original image's pixels.
 */
export function findFaceBox(img: Pixels): FoundFace | null {
  const { px, scale } = downscale(img)
  const I = integral(px)
  const minSide = Math.min(px.width, px.height)

  type Cand = { x: number; y: number; s: number; score: number }
  const inside = (x: number, y: number, s: number) =>
    x >= 0 && y >= 0 && x + s <= px.width && y + s <= px.height

  // 1. Coarse search; keep the best few that are not near each other.
  const coarse: Cand[] = []
  for (let s = minSide * 0.25; s <= minSide * 0.98; s *= 1.06) {
    const step = Math.max(1, s / 16)
    for (let y = 0; y + s <= px.height; y += step)
      for (let x = 0; x + s <= px.width; x += step)
        coarse.push({ x, y, s, score: score(I, x, y, s) })
  }
  coarse.sort((a, b) => b.score - a.score)
  const seeds: Cand[] = []
  for (const c of coarse) {
    const near = seeds.some(
      (o) => Math.hypot(o.x + o.s / 2 - c.x - c.s / 2, o.y + o.s / 2 - c.y - c.s / 2) < o.s * 0.25,
    )
    if (!near) seeds.push(c)
    if (seeds.length === 6) break
  }

  // 2. Fine search around each seed; keep the overall best.
  let best: Cand = seeds[0] ?? { x: 0, y: 0, s: 0, score: -Infinity }
  for (const seed of seeds) {
    let local = seed
    for (let round = 0; round < 2; round++) {
      const b = local
      const step = Math.max(0.5, b.s / (round === 0 ? 40 : 80))
      for (let ds = -3; ds <= 3; ds++)
        for (let dy = -4; dy <= 4; dy++)
          for (let dx = -4; dx <= 4; dx++) {
            const x = b.x + dx * step
            const y = b.y + dy * step
            const s = b.s + ds * step
            if (!inside(x, y, s)) continue
            const sc = score(I, x, y, s)
            if (sc > local.score) local = { x, y, s, score: sc }
          }
    }
    if (local.score > best.score) best = local
  }

  if (best.score < 0.05) return null
  return {
    box: {
      x: Math.round(best.x / scale),
      y: Math.round(best.y / scale),
      size: Math.round(best.s / scale),
    },
    score: best.score,
  }
}

/**
 * Fast follow-up search: looks only around where the cube was last found
 * (a little bigger/smaller, a little to each side). Much cheaper than
 * findFaceBox, so it can run on every frame while the cube is in view.
 * Returns null if the cube isn't near there any more.
 */
export function findFaceBoxNear(img: Pixels, last: Box, minScore = 0.25): FoundFace | null {
  const { px, scale } = downscale(img)
  const I = integral(px)
  const inside = (x: number, y: number, s: number) =>
    x >= 0 && y >= 0 && x + s <= px.width && y + s <= px.height && s >= 8
  const lx = last.x * scale
  const ly = last.y * scale
  const ls = last.size * scale

  let best = { x: lx, y: ly, s: ls, score: -Infinity }
  for (let s = ls * 0.82; s <= ls * 1.22; s *= 1.05) {
    const step = Math.max(0.75, s / 20)
    const cx = lx + ls / 2
    const cy = ly + ls / 2
    for (let dy = -0.35 * ls; dy <= 0.35 * ls; dy += step)
      for (let dx = -0.35 * ls; dx <= 0.35 * ls; dx += step) {
        const x = cx + dx - s / 2
        const y = cy + dy - s / 2
        if (!inside(x, y, s)) continue
        const sc = score(I, x, y, s)
        if (sc > best.score) best = { x, y, s, score: sc }
      }
  }
  // One fine pass around the best.
  const b = best
  const step = Math.max(0.5, b.s / 60)
  for (let ds = -2; ds <= 2; ds++)
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const x = b.x + dx * step
        const y = b.y + dy * step
        const s = b.s + ds * step
        if (!inside(x, y, s)) continue
        const sc = score(I, x, y, s)
        if (sc > best.score) best = { x, y, s, score: sc }
      }

  if (best.score < minScore) return null
  return {
    box: {
      x: Math.round(best.x / scale),
      y: Math.round(best.y / scale),
      size: Math.round(best.s / scale),
    },
    score: best.score,
  }
}
