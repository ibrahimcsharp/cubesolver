/**
 * Builds the cube from 6 captured sides, however they were shown.
 *
 * People don't always show the sides in the asked order, or the right way up.
 * So instead of trusting the order:
 *  1. Which side is which: the 6 middle stickers must be the 6 different
 *     colors. We match them to colors all at once (Hungarian method), after
 *     balancing the camera's white balance on the whole cube (a cube has the
 *     same amount of every color, so its average color is known).
 *  2. Read all 54 stickers (9 per color, light corrected per photo).
 *  3. Which way up each side was: try all 4 turns of every side
 *     (4^6 = 4096 ways) and keep the one where every corner and edge is a
 *     real piece. Ties go to the way the instructions asked for.
 *  4. If it still isn't a real cube, swap the colors of the stickers we were
 *     least sure about, a pair at a time, when that makes the cube real.
 *     Those stickers are marked for the user to check.
 */
import {
  CENTER_FACELETS,
  fromFacelets,
  permutationParity,
  SCAN_ORDER,
  STANDARD_CENTERS,
  type Face,
  type StickerColor,
} from '@/modules/cube'
import { classifyStickers, LOW_CONFIDENCE } from './classify'
import { colorDistance, fromLinear, NOMINAL_RGB, rgbToLab, toLinear, type RGB } from './color'
import { imageCellsToFacelets, rotateGridClockwise } from './faceMapping'
import { assign } from './hungarian'

export type Reconstruction = {
  /** 54 colors in U R F D L B order. */
  colors: StickerColor[]
  /** True if the result is a real, solvable cube. */
  valid: boolean
  /** Sticker indices the user should double-check. */
  uncertain: number[]
  /** For each capture: which color side it was. */
  sides: StickerColor[]
  /**
   * When it isn't a real cube: captures (by index) whose stickers are in the
   * most impossible pieces, so the user knows which side to retake.
   */
  suspects: number[]
  /** True if the camera turned out to deliver mirror images. */
  mirrored: boolean
}

/** A capture flipped left to right (some webcams send mirror images). */
const MIRROR_CELLS = [2, 1, 0, 5, 4, 3, 8, 7, 6]
const mirror = (captures: readonly RGB[][]) => captures.map((c) => MIRROR_CELLS.map((i) => c[i]!))

const COLOR_ORDER: StickerColor[] = ['white', 'yellow', 'green', 'blue', 'red', 'orange']
const FACE_OF_COLOR = Object.fromEntries(
  Object.entries(STANDARD_CENTERS).map(([f, c]) => [c, f]),
) as Record<StickerColor, Face>
const COLOR_LETTER = Object.fromEntries(
  Object.entries(STANDARD_CENTERS).map(([f, c]) => [c, f]),
) as Record<StickerColor, string>

/** Color direction without brightness (so dim and bright photos compare). */
function chroma([r, g, b]: RGB): [number, number] {
  const s = r + g + b || 1e-6
  return [r / s, g / s]
}

/**
 * White balance from the whole cube: a cube has 9 stickers of each color, so
 * the average of all 54 should look like the average of the 6 standard
 * colors. This undoes warm bulbs, candle light, blue screens and so on.
 */
function whiteBalance(captures: readonly RGB[][]): RGB[][] {
  const all = captures.flat().map(toLinear)
  const avg = [0, 1, 2].map((k) => all.reduce((s, c) => s + c[k]!, 0) / all.length)
  const nominal = COLOR_ORDER.map((c) => toLinear(NOMINAL_RGB[c]))
  const target = [0, 1, 2].map((k) => nominal.reduce((s, c) => s + c[k]!, 0) / nominal.length)
  const gains = [0, 1, 2].map((k) => target[k]! / Math.max(1e-6, avg[k]!))
  return captures.map((cap) =>
    cap.map((rgb) => fromLinear(toLinear(rgb).map((v, k) => v * gains[k]!) as unknown as RGB)),
  )
}

/** 1. Decide which color each capture's middle sticker is. */
function identifySides(captures: readonly RGB[][]): StickerColor[] {
  const nominalChroma = COLOR_ORDER.map((c) => chroma(toLinear(NOMINAL_RGB[c])))
  const cost = captures.map((cap) => {
    const c = chroma(toLinear(cap[4]!))
    return nominalChroma.map((n) => Math.hypot(c[0] - n[0], c[1] - n[1]))
  })
  return assign(cost).map((k) => COLOR_ORDER[k]!)
}

/** Where each image cell goes, for a side held as asked, then turned `turns` times. */
function placement(side: StickerColor, turns: number): number[] {
  const step = SCAN_ORDER.find((s) => s.front === side)!
  let cells = imageCellsToFacelets(FACE_OF_COLOR[side], FACE_OF_COLOR[step.top])
  // A capture of a side turned clockwise shows the cells turned the same way.
  for (let t = 0; t < turns; t++) cells = rotateGridClockwise(cells)
  return cells
}
const PLACEMENTS: Record<StickerColor, number[][]> = Object.fromEntries(
  COLOR_ORDER.map((c) => [c, [0, 1, 2, 3].map((t) => placement(c, t))]),
) as Record<StickerColor, number[][]>

/** How good a set of colors is: real pieces count, a fully real cube wins. */
function score(letters: string[]): { score: number; valid: boolean } {
  const { cube, problems } = fromFacelets(letters.join(''))
  let s = (20 - problems.length) * 10
  if (problems.length > 0) return { score: s, valid: false }
  const allCorners = new Set(cube.cp).size === 8
  const allEdges = new Set(cube.ep).size === 12
  const twist = cube.co.reduce((a, b) => a + b, 0) % 3 === 0
  const flip = cube.eo.reduce((a, b) => a + b, 0) % 2 === 0
  const parity = permutationParity(cube.cp) === permutationParity(cube.ep)
  const valid = allCorners && allEdges && twist && flip && parity
  s +=
    (allCorners ? 5 : 0) + (allEdges ? 5 : 0) + (twist ? 5 : 0) + (flip ? 5 : 0) + (parity ? 5 : 0)
  return { score: valid ? s + 100 : s, valid }
}

function layout(captureColors: StickerColor[][], sides: StickerColor[], turns: number[]): string[] {
  const letters: string[] = Array(54)
  captureColors.forEach((colors, k) =>
    PLACEMENTS[sides[k]!]![turns[k]!]!.forEach(
      (f, cell) => (letters[f] = COLOR_LETTER[colors[cell]!]),
    ),
  )
  return letters
}

/** 3. Best turn for every side (all 4096 combinations). */
function bestTurns(captureColors: StickerColor[][], sides: StickerColor[]) {
  let best = { turns: [0, 0, 0, 0, 0, 0], score: -1, valid: false }
  for (let code = 0; code < 4096; code++) {
    const turns = [0, 1, 2, 3, 4, 5].map((k) => (code >> (2 * k)) & 3)
    const { score: s, valid } = score(layout(captureColors, sides, turns))
    // Prefer sides held as asked (turn 0) when scores tie.
    const adjusted = s - turns.filter((t) => t !== 0).length * 0.01
    if (adjusted > best.score) best = { turns, score: adjusted, valid }
  }
  return best
}

/**
 * @param captures 6 captured sides, 9 colors each as the camera saw them
 *   (row by row), in any order and any turn.
 */
export function reconstructCube(rawCaptures: readonly RGB[][]): Reconstruction {
  if (rawCaptures.length !== 6) throw new Error('Need 6 sides')
  // Read it with and without the whole-cube white balance (it helps a lot in
  // strongly colored light, a little less with glare), keep the better. If
  // neither is a real cube, the webcam may be sending mirror images: try that too.
  const rank = (x: ReturnType<typeof readCube>) =>
    (x.result.valid ? 1000 : 0) - x.result.uncertain.length * 10 + x.meanConfidence
  let best = readCube(whiteBalance(rawCaptures), false)
  if (best.result.valid && best.result.uncertain.length === 0) return best.result
  const attempts = [
    () => readCube(rawCaptures, false),
    () => readCube(whiteBalance(mirror(rawCaptures)), true),
    () => readCube(mirror(rawCaptures), true),
  ]
  for (const attempt of attempts) {
    const next = attempt()
    if (rank(next) > rank(best)) best = next
    if (best.result.valid && best.result.uncertain.length === 0) break
  }
  return best.result
}

function readCube(
  captures: readonly RGB[][],
  mirrored: boolean,
): { result: Reconstruction; meanConfidence: number } {
  const sides = identifySides(captures)

  // 2. Read the stickers. Put each capture where its side goes (turn 0 for now;
  //    turning only moves stickers within the same photo, so it doesn't matter here).
  const rgbs: RGB[] = Array(54)
  captures.forEach((cap, k) =>
    PLACEMENTS[sides[k]!]![0]!.forEach((f, cell) => (rgbs[f] = cap[cell]!)),
  )
  const centers = STANDARD_CENTERS as Record<Face, StickerColor>
  const read = classifyStickers(rgbs, centers)
  const captureColors = captures.map((_, k) =>
    PLACEMENTS[sides[k]!]![0]!.map((f) => read.colors[f]!),
  )
  const captureConfidence = captures.map((_, k) =>
    PLACEMENTS[sides[k]!]![0]!.map((f) => read.confidence[f]!),
  )

  // 3. Find how each side was turned.
  let best = bestTurns(captureColors, sides)
  const changed = new Set<string>() // "capture:cell"

  // 4. Not real yet: try swapping pairs of the least certain stickers.
  for (let round = 0; round < 3 && !best.valid; round++) {
    const doubtful = captureConfidence
      .flatMap((conf, k) => conf.map((c, cell) => ({ k, cell, c })))
      .filter((x) => x.cell !== 4)
      .sort((a, b) => a.c - b.c)
      .slice(0, 14)
    let bestSwap: {
      a: (typeof doubtful)[number]
      b: (typeof doubtful)[number]
      score: number
    } | null = null
    for (let i = 0; i < doubtful.length; i++)
      for (let j = i + 1; j < doubtful.length; j++) {
        const a = doubtful[i]!
        const b = doubtful[j]!
        const ca = captureColors[a.k]![a.cell]!
        const cb = captureColors[b.k]![b.cell]!
        if (ca === cb) continue
        captureColors[a.k]![a.cell] = cb
        captureColors[b.k]![b.cell] = ca
        const s = score(layout(captureColors, sides, best.turns)).score
        captureColors[a.k]![a.cell] = ca
        captureColors[b.k]![b.cell] = cb
        if (s > best.score + 0.5 && (!bestSwap || s > bestSwap.score)) bestSwap = { a, b, score: s }
      }
    if (!bestSwap) break
    const { a, b } = bestSwap
    const ca = captureColors[a.k]![a.cell]!
    captureColors[a.k]![a.cell] = captureColors[b.k]![b.cell]!
    captureColors[b.k]![b.cell] = ca
    captureConfidence[a.k]![a.cell] = captureConfidence[b.k]![b.cell] = 1 // don't swap back
    changed.add(`${a.k}:${a.cell}`).add(`${b.k}:${b.cell}`)
    best = bestTurns(captureColors, sides)
  }

  // Final colors and which stickers to check, in cube order.
  const colors: StickerColor[] = Array(54)
  const uncertain = new Set<number>()
  const centerSet = new Set(Object.values(CENTER_FACELETS))
  captureColors.forEach((cc, k) =>
    PLACEMENTS[sides[k]!]![best.turns[k]!]!.forEach((f, cell) => {
      colors[f] = cc[cell]!
      if (centerSet.has(f)) return
      if (changed.has(`${k}:${cell}`) || captureConfidence[k]![cell]! < LOW_CONFIDENCE)
        uncertain.add(f)
    }),
  )
  // A capture that doesn't match the cube's colors: flag all its stickers and
  // name it, even if the result looks like a real cube.
  const outlier = misfitOutlier(captures)
  if (outlier !== null)
    PLACEMENTS[sides[outlier]!]![best.turns[outlier]!]!.forEach((f) => {
      if (!centerSet.has(f)) uncertain.add(f)
    })
  const meanConfidence = read.confidence.reduce((s, c) => s + c, 0) / read.confidence.length
  return {
    result: {
      colors,
      valid: best.valid,
      uncertain: [...uncertain].sort((a, b) => a - b),
      sides,
      suspects: !best.valid
        ? suspectCaptures(captures, captureColors, captureConfidence, sides, best.turns)
        : outlier !== null
          ? [outlier]
          : [],
      mirrored,
    },
    meanConfidence,
  }
}

/**
 * A photo of something that isn't the cube (or a blurry one) has stickers
 * that don't really match any of the 6 middle colors. Returns the one capture
 * clearly worse than all the others, if there is one.
 */
function misfitOutlier(captures: readonly RGB[][]): number | null {
  const centers = captures.map((c) => rgbToLab(c[4]!))
  const misfit = captures.map((c) => {
    const outer = c.filter((_, cell) => cell !== 4).map(rgbToLab)
    return (
      outer.reduce((s, lab) => s + Math.min(...centers.map((m) => colorDistance(lab, m))), 0) / 8
    )
  })
  const ranked = misfit.map((m, k) => ({ m, k })).sort((a, b) => b.m - a.m)
  const others = ranked
    .slice(1)
    .map((r) => r.m)
    .sort((a, b) => a - b)
  return ranked[0]!.m > Math.max(8, others[2]! * 1.6) ? ranked[0]!.k : null
}

/**
 * Which captures look wrong. For each side, we ignore it and count the
 * impossible pieces left; a single bad photo explains (nearly) all of them.
 * Ties are broken by how unsure the reader was of that side's colors.
 */
function suspectCaptures(
  captures: readonly RGB[][],
  captureColors: StickerColor[][],
  captureConfidence: number[][],
  sides: StickerColor[],
  turns: number[],
): number[] {
  const outlier = misfitOutlier(captures)
  if (outlier !== null) return [outlier]

  const owner: number[] = Array(54)
  captureColors.forEach((_, k) => PLACEMENTS[sides[k]!]![turns[k]!]!.forEach((f) => (owner[f] = k)))
  const { problems } = fromFacelets(layout(captureColors, sides, turns).join(''))
  if (problems.length === 0) {
    // Real pieces but not a real cube (e.g. a piece twice): fall back to doubt.
    const doubt = captureConfidence.map((conf) => 1 - conf.reduce((a, b) => a + b, 0) / conf.length)
    const worst = doubt.indexOf(Math.max(...doubt))
    return [worst]
  }
  const left = [0, 1, 2, 3, 4, 5].map(
    (k) => problems.filter((p) => !p.facelets.some((f) => owner[f] === k)).length,
  )
  const fewest = Math.min(...left)
  // Only point at a side if leaving it out clearly helps.
  if (fewest > problems.length / 2) return []
  const doubt = captureConfidence.map((conf) => 1 - conf.reduce((a, b) => a + b, 0) / conf.length)
  return left
    .map((n, k) => ({ n, k }))
    .filter((x) => x.n === fewest)
    .sort((a, b) => doubt[b.k]! - doubt[a.k]!)
    .slice(0, 2)
    .map((x) => x.k)
}
