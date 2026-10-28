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

/**
 * The suggested scan order (PLAN.md section 4.3). It is only a suggestion:
 * the app works out which side each capture is and which way up it was held.
 * `top` is the side we suggest keeping on top for each step.
 */
export const SCAN_ORDER: readonly ScanStep[] = [
  { front: 'green', top: 'white', instruction: 'Hold green toward the camera, white on top.' },
  {
    front: 'red',
    top: 'white',
    instruction: 'Show the red side to the camera, white still on top.',
  },
  {
    front: 'blue',
    top: 'white',
    instruction: 'Show the blue side to the camera, white still on top.',
  },
  {
    front: 'orange',
    top: 'white',
    instruction: 'Show the orange side to the camera, white still on top.',
  },
  { front: 'white', top: 'blue', instruction: 'Show the white side to the camera.' },
  { front: 'yellow', top: 'green', instruction: 'Last one: show the yellow side to the camera.' },
]

/** A solved cube as a facelet string: "UUUUUUUUURRRRRRRRR...". */
export const SOLVED_FACELETS = FACES.map((f) => f.repeat(STICKERS_PER_FACE)).join('')
