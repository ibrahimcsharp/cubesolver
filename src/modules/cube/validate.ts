/**
 * Checks that 54 scanned sticker colors form a real, solvable cube, and
 * explains any problem in plain English (PLAN.md section 6).
 */
import { COLORS, FACES, type Face, type StickerColor } from './constants'
import { permutationParity, type CubieCube } from './cubie'
import { CENTER_FACELETS, CORNER_FACELETS, EDGE_FACELETS, fromFacelets } from './facelets'

export type ValidationErrorCode =
  | 'wrong-length'
  | 'color-count'
  | 'duplicate-centers'
  | 'impossible-piece'
  | 'duplicate-piece'
  | 'twisted-corner'
  | 'flipped-edge'
  | 'swapped-pieces'

export type ValidationError = {
  code: ValidationErrorCode
  message: string
  /** Sticker indices (0-53) to highlight on the Check & Correct screen. */
  stickers: number[]
}

export type ValidCube = {
  ok: true
  /** 54-letter facelet string (U R F D L B order). */
  facelets: string
  cube: CubieCube
  /** Real color of each face's center, used for plain-English instructions. */
  colorOf: Record<Face, StickerColor>
}

export type ValidationResult = ValidCube | { ok: false; errors: ValidationError[] }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function faceName(face: Face, colorOf: Partial<Record<Face, StickerColor>>): string {
  const color = colorOf[face]
  return color ? `the ${color} face` : `face ${face}`
}

export function validateColors(colors: readonly StickerColor[]): ValidationResult {
  if (colors.length !== 54) {
    return {
      ok: false,
      errors: [
        {
          code: 'wrong-length',
          message: `Expected 54 stickers but got ${colors.length}.`,
          stickers: [],
        },
      ],
    }
  }

  const errors: ValidationError[] = []

  // 1. Exactly 9 stickers of each color.
  const counts = new Map<StickerColor, number>(COLORS.map((c) => [c, 0]))
  colors.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1))
  const over = COLORS.filter((c) => counts.get(c)! > 9)
  const under = COLORS.filter((c) => counts.get(c)! < 9)
  if (over.length || under.length) {
    const parts = [
      ...over.map((c) => `${counts.get(c)} ${c}`),
      ...under.map((c) => `${counts.get(c)} ${c}`),
    ]
    const centers = new Set(Object.values(CENTER_FACELETS))
    errors.push({
      code: 'color-count',
      message: `Each color should appear 9 times, but we found ${parts.join(' and ')}. Please check the highlighted stickers.`,
      stickers: colors.flatMap((c, i) => (over.includes(c) && !centers.has(i) ? [i] : [])),
    })
  }

  // 2. Six different center colors.
  const colorOf: Partial<Record<Face, StickerColor>> = {}
  const faceOfColor = new Map<StickerColor, Face>()
  for (const face of FACES) {
    const color = colors[CENTER_FACELETS[face]]!
    colorOf[face] = color
    const other = faceOfColor.get(color)
    if (other) {
      errors.push({
        code: 'duplicate-centers',
        message: `Two faces have the same ${color} center. Please rescan ${faceName(face, {})} or ${faceName(other, {})}.`,
        stickers: [CENTER_FACELETS[face], CENTER_FACELETS[other]],
      })
    } else {
      faceOfColor.set(color, face)
    }
  }
  if (errors.length) return { ok: false, errors }

  // 3. Every corner and edge must be a real piece.
  const facelets = colors.map((c) => faceOfColor.get(c)!).join('')
  const { cube, problems } = fromFacelets(facelets)
  for (const p of problems) {
    const names = p.facelets.map((i) => colors[i]).join('-')
    errors.push({
      code: 'impossible-piece',
      message: `There is no ${names} ${p.kind} on a real cube. Please check these stickers.`,
      stickers: [...p.facelets],
    })
  }
  if (errors.length) return { ok: false, errors }

  // 4. Each piece exactly once.
  const dupCorners = cube.cp.flatMap((piece, pos) =>
    cube.cp.indexOf(piece) !== pos ? [pos, cube.cp.indexOf(piece)] : [],
  )
  const dupEdges = cube.ep.flatMap((piece, pos) =>
    cube.ep.indexOf(piece) !== pos ? [pos, cube.ep.indexOf(piece)] : [],
  )
  if (dupCorners.length || dupEdges.length) {
    errors.push({
      code: 'duplicate-piece',
      message: 'The same piece appears twice. Please check the highlighted stickers.',
      stickers: [
        ...new Set([
          ...dupCorners.flatMap((pos) => [...CORNER_FACELETS[pos]!]),
          ...dupEdges.flatMap((pos) => [...EDGE_FACELETS[pos]!]),
        ]),
      ],
    })
    return { ok: false, errors }
  }

  // 5. Rules every real cube follows.
  if (cube.co.reduce((s, x) => s + x, 0) % 3 !== 0) {
    errors.push({
      code: 'twisted-corner',
      message:
        'One corner seems to be twisted in place. This can happen if a sticker was misread or the cube was taken apart. Please check the corners.',
      stickers: CORNER_FACELETS.flat(),
    })
  }
  if (cube.eo.reduce((s, x) => s + x, 0) % 2 !== 0) {
    errors.push({
      code: 'flipped-edge',
      message:
        'One edge seems to be flipped in place. This can happen if a sticker was misread or the cube was taken apart. Please check the edges.',
      stickers: EDGE_FACELETS.flat(),
    })
  }
  if (permutationParity(cube.cp) !== permutationParity(cube.ep)) {
    errors.push({
      code: 'swapped-pieces',
      message:
        'Two pieces seem to be swapped. This can happen if two stickers were misread or the cube was taken apart. Please check the scan.',
      stickers: [],
    })
  }
  if (errors.length) return { ok: false, errors }

  return { ok: true, facelets, cube, colorOf: colorOf as Record<Face, StickerColor> }
}

/** Helper for messages: "White", "Green"… */
export function colorLabel(color: StickerColor): string {
  return cap(color)
}
