import { describe, expect, it } from 'vitest'
import {
  COLORS,
  FACES,
  SCAN_ORDER,
  SOLVED_FACELETS,
  STANDARD_CENTERS,
  TOTAL_STICKERS,
} from './constants'

describe('cube constants', () => {
  it('has 6 faces, 6 colors and 54 stickers', () => {
    expect(FACES).toHaveLength(6)
    expect(COLORS).toHaveLength(6)
    expect(TOTAL_STICKERS).toBe(54)
    expect(SOLVED_FACELETS).toHaveLength(54)
  })

  it('gives every face a different center color', () => {
    expect(new Set(Object.values(STANDARD_CENTERS)).size).toBe(6)
  })

  it('scans each color exactly once', () => {
    const fronts = SCAN_ORDER.map((s) => s.front)
    expect(new Set(fronts).size).toBe(6)
  })

  it('never has the top color equal to the front color, or opposite it', () => {
    const opposite: Record<string, string> = {
      white: 'yellow',
      yellow: 'white',
      green: 'blue',
      blue: 'green',
      red: 'orange',
      orange: 'red',
    }
    for (const step of SCAN_ORDER) {
      expect(step.top).not.toBe(step.front)
      expect(step.top).not.toBe(opposite[step.front])
    }
  })
})
