/**
 * Where each of the 54 stickers sits in 3D (x = right, y = up, z = front),
 * and how to redraw the cube as the user is currently holding it.
 * Also used by the 3D cube in Phase 4.
 */
import { FACES, type Face } from './constants'
import type { Orientation } from './orientation'

export type Vec3 = readonly [number, number, number]

export const FACE_NORMALS: Record<Face, Vec3> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
}

/** Center of the piece a sticker is on (coordinates -1, 0 or 1), by face, row and column. */
function piecePosition(face: Face, r: number, c: number): Vec3 {
  switch (face) {
    case 'U':
      return [c - 1, 1, r - 1]
    case 'R':
      return [1, 1 - r, 1 - c]
    case 'F':
      return [c - 1, 1 - r, 1]
    case 'D':
      return [c - 1, -1, 1 - r]
    case 'L':
      return [-1, 1 - r, c - 1]
    case 'B':
      return [1 - c, 1 - r, -1]
  }
}

export type StickerGeometry = { face: Face; position: Vec3; normal: Vec3 }

export const STICKERS: readonly StickerGeometry[] = FACES.flatMap((face) =>
  Array.from({ length: 9 }, (_, i) => ({
    face,
    position: piecePosition(face, Math.floor(i / 3), i % 3),
    normal: FACE_NORMALS[face],
  })),
)

const key = (p: Vec3, n: Vec3) => `${p.join(',')}|${n.join(',')}`
const INDEX_BY_KEY = new Map(STICKERS.map((s, i) => [key(s.position, s.normal), i]))

const viewCache = new Map<string, number[]>()

/**
 * For each sticker as the user sees it, the index of the fixed-model sticker
 * that is there. Turning the whole cube changes this mapping only.
 */
export function viewMapping(o: Orientation): number[] {
  const cacheKey = `${o.U}${o.F}`
  const cached = viewCache.get(cacheKey)
  if (cached) return cached

  const [rx, ux, fx] = [FACE_NORMALS[o.R], FACE_NORMALS[o.U], FACE_NORMALS[o.F]]
  const toFixed = (v: Vec3): Vec3 =>
    [0, 1, 2].map((k) => v[0] * rx[k]! + v[1] * ux[k]! + v[2] * fx[k]!) as unknown as Vec3

  const mapping = STICKERS.map((s) => {
    const idx = INDEX_BY_KEY.get(key(toFixed(s.position), toFixed(s.normal)))
    if (idx === undefined) throw new Error('Bad orientation')
    return idx
  })
  viewCache.set(cacheKey, mapping)
  return mapping
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** Quarter turn clockwise (as seen looking at the face) about axis n. */
function quarterClockwise(v: Vec3, n: Vec3): Vec3 {
  const c = cross(n, v)
  const d = dot(n, v)
  return [-c[0] + n[0] * d, -c[1] + n[1] * d, -c[2] + n[2] * d]
}

/**
 * Applies a face turn directly to a sticker string using 3D positions.
 * Gives the same result as the piece model; the 3D animation uses the same math.
 */
export function turnStickers(facelets: string, face: Face, turns: 1 | 2 | 3): string {
  const n = FACE_NORMALS[face]
  const out = [...facelets]
  STICKERS.forEach((s, i) => {
    if (dot(s.position, n) !== 1) return
    let p = s.position
    let nv = s.normal
    for (let t = 0; t < turns; t++) {
      p = quarterClockwise(p, n)
      nv = quarterClockwise(nv, n)
    }
    out[INDEX_BY_KEY.get(key(p, nv))!] = facelets[i]!
  })
  return out.join('')
}

/** The facelet string as the user sees it while holding the cube this way. */
export function viewFacelets(facelets: string, o: Orientation): string {
  return viewMapping(o)
    .map((i) => facelets[i])
    .join('')
}
