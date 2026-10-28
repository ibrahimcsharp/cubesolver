/**
 * Turns 54 sampled sticker colors into the 6 cube colors.
 *
 * Each of the 6 photos may have its own lighting (the webcam adjusts itself,
 * or phone photos are taken in different spots). So we work out a correction
 * for each photo while reading the colors:
 *
 * 1. Start: scale each photo's brightness so its center sticker has the
 *    usual brightness for that color.
 * 2. Read: give every sticker a color so each color has exactly 9 stickers
 *    and the total color difference is smallest (Hungarian method).
 * 3. Correct: from that reading, work out each photo's brightness and tint
 *    (how much more red/green/blue it got) and undo it. Update each color's
 *    reference to the average of its 9 stickers.
 * 4. Repeat 2-3 until the reading stops changing.
 *
 * Each sticker also gets a confidence score: how much closer it is to its own
 * color than to the next best. Low scores are shown on the Check screen.
 */
import { CENTER_FACELETS, FACES, type Face, type StickerColor } from '@/modules/cube'
import {
  colorDistance,
  linearToLab,
  luminance,
  NOMINAL_RGB,
  toLinear,
  type Lab,
  type RGB,
} from './color'
import { assign } from './hungarian'

export type ClassifiedCube = {
  colors: StickerColor[]
  /** 0 (a guess) to 1 (certain), per sticker. */
  confidence: number[]
}

/** Below this confidence a sticker is highlighted for the user to check. */
export const LOW_CONFIDENCE = 0.2

const clampGain = (g: number) => Math.max(0.25, Math.min(4, g))
/** How much of the per-channel (tint) correction to trust vs plain brightness. */
const TINT_WEIGHT = 0.6

/**
 * @param rgbs 54 sticker colors (sRGB 0-255) in facelet order (U R F D L B,
 *   9 each). Stickers 9k..9k+8 must come from the same photo.
 * @param centerColor the color each face's center is known to be.
 */
export function classifyStickers(
  rgbs: readonly RGB[],
  centerColor: Record<Face, StickerColor>,
): ClassifiedCube {
  if (rgbs.length !== 54) throw new Error('Need 54 stickers')
  const lin = rgbs.map(toLinear)
  const centerIndex = new Set(Object.values(CENTER_FACELETS))
  const photo = (i: number) => Math.floor(i / 9)

  // 1. Start: match each photo's center to that color's usual brightness.
  //    Also take a little of the center's tint into account (a little only:
  //    a strongly colored center says little about the weak channels).
  let gains: RGB[] = FACES.map((face, k) => {
    const center = lin[9 * k + 4]!
    const nominal = toLinear(NOMINAL_RGB[centerColor[face]])
    const g = clampGain(luminance(nominal) / Math.max(1e-4, luminance(center)))
    return [0, 1, 2].map((ch) => {
      const share = nominal[ch]! / (nominal[0]! + nominal[1]! + nominal[2]!)
      const perChannel = nominal[ch]! / Math.max(1e-4, center[ch]!)
      // Trust a channel's ratio in proportion to how much of the center's light it carries.
      return clampGain(
        Math.exp(share * Math.log(clampGain(perChannel)) + (1 - share) * Math.log(g)),
      )
    }) as unknown as RGB
  })

  const correct = () =>
    lin.map((c, i) => c.map((v, ch) => v * gains[photo(i)]![ch]!) as unknown as RGB)
  let corrected = correct()
  let labs = corrected.map(linearToLab)
  let refs: Lab[] = FACES.map((f) => labs[CENTER_FACELETS[f]]!)
  let faceOf: number[] = []

  for (let round = 0; round < 10; round++) {
    // 2. Read with the 9-per-color rule.
    const cost = labs.map((lab, i) => {
      const row: number[] = []
      for (let k = 0; k < 6; k++) {
        const isOwnCenter = CENTER_FACELETS[FACES[k]!] === i
        const c = centerIndex.has(i) && !isOwnCenter ? 1e6 : colorDistance(lab, refs[k]!)
        for (let s = 0; s < 9; s++) row.push(c)
      }
      return row
    })
    const next = assign(cost).map((col) => Math.floor(col / 9))
    const changed = next.some((k, i) => k !== faceOf[i])
    faceOf = next
    if (!changed && round > 0) break

    // 3. Each color's reference = average of its stickers (linear light).
    const refLin: RGB[] = FACES.map((_, k) => {
      const members = corrected.filter((_, i) => faceOf[i] === k)
      return [0, 1, 2].map(
        (ch) => members.reduce((s, m) => s + m[ch]!, 0) / members.length,
      ) as unknown as RGB
    })

    // ...and each photo's correction = what best maps its stickers onto those references.
    gains = FACES.map((_, p) => {
      const idx = Array.from({ length: 9 }, (_, j) => 9 * p + j)
      const perChannel = [0, 1, 2].map((ch) => {
        let num = 0
        let den = 0
        for (const i of idx) {
          num += refLin[faceOf[i]!]![ch]! * lin[i]![ch]!
          den += lin[i]![ch]! ** 2
        }
        return den > 0 ? num / den : 1
      })
      const overall = perChannel.reduce((a, b) => a + b, 0) / 3
      return perChannel.map((g) =>
        clampGain(TINT_WEIGHT * g + (1 - TINT_WEIGHT) * overall),
      ) as unknown as RGB
    })
    // Keep the overall level steady (gains and references could drift together).
    const mean = [0, 1, 2].map((ch) =>
      Math.exp(gains.reduce((s, g) => s + Math.log(g[ch]!), 0) / 6),
    )
    gains = gains.map((g) => g.map((v, ch) => v / mean[ch]!) as unknown as RGB)

    corrected = correct()
    labs = corrected.map(linearToLab)
    refs = FACES.map((_, k) => {
      const members = labs.filter((_, i) => faceOf[i] === k)
      return [0, 1, 2].map(
        (d) => members.reduce((s, m) => s + m[d]!, 0) / members.length,
      ) as unknown as Lab
    })
  }

  const confidence = labs.map((lab, i) => {
    if (centerIndex.has(i)) return 1
    const own = colorDistance(lab, refs[faceOf[i]!]!)
    const other = Math.min(
      ...refs.filter((_, k) => k !== faceOf[i]).map((r) => colorDistance(lab, r)),
    )
    return other + own === 0 ? 0 : Math.max(0, (other - own) / (other + own))
  })

  return { colors: faceOf.map((k) => centerColor[FACES[k]!]), confidence }
}
