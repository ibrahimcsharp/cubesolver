/**
 * Shared cube vocabulary. Matches the decisions in PLAN.md:
 * - Facelet strings use the face order U, R, F, D, L, B (the Kociemba format).
 * - The standard holding position is white on top, green facing the camera.
 */

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const
export type Face = (typeof FACES)[number]

export const COLORS = ['white', 'red', 'green', 'yellow', 'orange', 'blue'] as const
export type StickerColor = (typeof COLORS)[number]

/** Center color of each face in the standard holding position. */
export const STANDARD_CENTERS: Record<Face, StickerColor> = {
  U: 'white',
  R: 'red',
  F: 'green',
  D: 'yellow',
  L: 'orange',
  B: 'blue',
}

export const STICKERS_PER_FACE = 9
export const TOTAL_STICKERS = FACES.length * STICKERS_PER_FACE

export type ScanStep = {
  /** Center color facing the camera. */
  front: StickerColor
  /** Center color on top while this face is captured. */
  top: StickerColor
  instruction: string
}

/** The 6-step scan order shown to the user (PLAN.md section 4.3). */
export const SCAN_ORDER: readonly ScanStep[] = [
  { front: 'green', top: 'white', instruction: 'Hold green toward the camera, white on top.' },
  {
    front: 'red',
    top: 'white',
    instruction: 'Turn the whole cube to the LEFT once (red now faces you). Keep white on top.',
  },
  { front: 'blue', top: 'white', instruction: 'Turn the whole cube LEFT again (blue faces you).' },
  {
    front: 'orange',
    top: 'white',
    instruction: 'Turn the whole cube LEFT again (orange faces you).',
  },
  {
    front: 'white',
    top: 'blue',
    instruction:
      'Turn LEFT once more to bring green back to the front. Now tip the top of the cube TOWARD you so white faces the camera.',
  },
  {
    front: 'yellow',
    top: 'green',
    instruction: 'Tip it back, then tip the top AWAY from you so yellow faces the camera.',
  },
]

/** A solved cube as a facelet string: "UUUUUUUUURRRRRRRRR...". */
export const SOLVED_FACELETS = FACES.map((f) => f.repeat(STICKERS_PER_FACE)).join('')
