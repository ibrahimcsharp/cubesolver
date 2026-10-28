/** Plain-English text for each move and whole-cube turn (PLAN.md section 7.1). */
import type { Face, Move, Rotation } from '@/modules/cube'

const QUARTER: Record<Face, { cw: string; ccw: string; name: string }> = {
  R: {
    cw: 'Turn the right side up, away from you',
    ccw: 'Turn the right side down, toward you',
    name: 'right side',
  },
  L: {
    cw: 'Turn the left side down, toward you',
    ccw: 'Turn the left side up, away from you',
    name: 'left side',
  },
  U: {
    cw: 'Turn the top layer to the left',
    ccw: 'Turn the top layer to the right',
    name: 'top layer',
  },
  D: {
    cw: 'Turn the bottom layer to the right',
    ccw: 'Turn the bottom layer to the left',
    name: 'bottom layer',
  },
  F: {
    cw: 'Turn the front face clockwise',
    ccw: 'Turn the front face counter-clockwise',
    name: 'front face',
  },
  B: {
    cw: 'Turn the back face clockwise (as seen from behind)',
    ccw: 'Turn the back face counter-clockwise (as seen from behind)',
    name: 'back face',
  },
}

export function describeMove(move: Move): string {
  const q = QUARTER[move.face]
  if (move.turns === 1) return q.cw
  if (move.turns === 3) return q.ccw
  return `Turn the ${q.name} twice (half turn)`
}

export function describeRotation(rotation: Rotation): string {
  switch (rotation) {
    case 'y':
      return 'Turn the whole cube to the left (the right side comes to the front)'
    case "y'":
      return 'Turn the whole cube to the right (the left side comes to the front)'
    case 'y2':
      return 'Turn the whole cube around (the back comes to the front)'
    case 'z2':
      return 'Turn the whole cube upside down, keeping the same side facing you'
  }
}
