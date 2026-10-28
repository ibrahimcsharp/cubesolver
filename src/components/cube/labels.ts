import type { Face } from '@/modules/cube'

/** Names of the faces on the flat cube map, as the user holds the cube. */
export const FACE_LABELS: Record<Face, string> = {
  U: 'Top',
  L: 'Left',
  F: 'Front',
  R: 'Right',
  B: 'Back',
  D: 'Bottom',
}
