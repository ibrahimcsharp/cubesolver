/**
 * Checks the user's moves from the webcam picture (PLAN.md section 8).
 *
 * Feed it each sampled frame. Once the picture has been steady for a moment,
 * it compares what the camera sees with every way the cube could look:
 *   - still before the current step         → keep waiting
 *   - after the step (or 1-2 steps further)  → done, move on
 *   - after some other single turn           → wrong; suggest the undo
 * Colors are judged in the room's own light: learned from the visible
 * middle sticker (its color never changes during face turns) and from
 * frames already confirmed.
 */
import {
  ALL_MOVES,
  formatMove,
  invertMove,
  turnStickers,
  type Face,
  type Move,
  type StickerColor,
} from '@/modules/cube'
import type { Step } from '@/modules/solution'
import {
  colorDistance,
  learnedGains,
  linearToLab,
  NOMINAL_RGB,
  rgbToLab,
  toLinear,
  type FaceSample,
  type Lab,
  type RGB,
} from '@/modules/vision'
import { cameraSees } from './camera-view'

export type CheckStatus =
  | 'no-face' // nothing that looks like a cube side in the box
  | 'moving'
  | 'waiting' // the step hasn't been done yet
  | 'done' // the step (and maybe more) was done
  | 'done-unchecked' // this step can't be seen from the camera; assumed done after the hands moved
  | 'wrong' // a different turn was made
  | 'unclear' // steady, but the colors don't clearly match anything

export type CheckResult = {
  status: CheckStatus
  /** For 'done': how many steps were completed. */
  advance?: number
  /** For 'wrong': the turn that puts it back. */
  undo?: Move
  undoText?: string
}

export type CheckerOptions = { steadyMs: number; maxChange: number }
const DEFAULTS: CheckerOptions = { steadyMs: 450, maxChange: 18 }

/** Scores: lower is a better match. A match must be this clear to count. */
const MAX_SCORE = 32
const CLEAR_MARGIN = 1.2

const NOMINAL_LAB = Object.fromEntries(
  Object.entries(NOMINAL_RGB).map(([c, rgb]) => [c, rgbToLab(rgb)]),
) as Record<StickerColor, Lab>

type Candidate = { face: string; kind: 'before' | 'after' | 'wrong'; advance?: number; undo?: Move }

export class MoveChecker {
  private readonly opts: CheckerOptions
  private anchor: Lab[] | null = null
  private steadySince: number | null = null
  private movedSinceStep = false
  /** Colors seen in confirmed frames (light-corrected), per sticker color. */
  private learned: Partial<Record<StickerColor, { lab: [number, number, number]; n: number }>> = {}
  private index = -1
  private views: readonly string[] = []
  private steps: readonly Step[] = []
  private colorOf: Record<Face, StickerColor>

  constructor(
    views: readonly string[],
    steps: readonly Step[],
    colorOf: Record<Face, StickerColor>,
    opts: Partial<CheckerOptions> = {},
  ) {
    this.views = views
    this.steps = steps
    this.colorOf = colorOf
    this.opts = { ...DEFAULTS, ...opts }
  }

  /** Call when the current step changes (done, back, skip). */
  setIndex(i: number): void {
    if (i === this.index) return
    this.index = i
    this.movedSinceStep = false
    this.steadySince = null
  }

  private candidates(): Candidate[] {
    const i = this.index
    const view = this.views[i]!
    const list: Candidate[] = [{ face: cameraSees(view), kind: 'before' }]
    for (let k = 1; k <= 3 && i + k < this.views.length; k++)
      list.push({ face: cameraSees(this.views[i + k]!), kind: 'after', advance: k })
    for (const m of ALL_MOVES) {
      list.push({
        face: cameraSees(turnStickers(view, m.face, m.turns)),
        kind: 'wrong',
        undo: invertMove(m),
      })
    }
    return list
  }

  private reference(color: StickerColor): Lab {
    const l = this.learned[color]
    return l ? (l.lab as unknown as Lab) : NOMINAL_LAB[color]
  }

  /** The 9 colors, corrected for the room light using the middle sticker's known color. */
  private corrected(rgbs: readonly RGB[], centerColor: StickerColor): Lab[] {
    const gains = learnedGains([{ color: centerColor, seen: toLinear(rgbs[4]!) }])
    return rgbs.map((rgb) =>
      linearToLab(toLinear(rgb).map((v, ch) => v * gains[ch]!) as unknown as RGB),
    )
  }

  private score(labs: Lab[], face: string): number {
    let sum = 0
    for (let k = 0; k < 9; k++)
      sum += colorDistance(labs[k]!, this.reference(this.colorOf[face[k] as Face]))
    return sum / 9
  }

  private learn(labs: Lab[], face: string): void {
    labs.forEach((lab, k) => {
      const color = this.colorOf[face[k] as Face]
      const prev = this.learned[color]
      const n = Math.min((prev?.n ?? 0) + 1, 20)
      const base = prev?.lab ?? [lab[0], lab[1], lab[2]]
      this.learned[color] = {
        lab: [0, 1, 2].map((d) => base[d]! + (lab[d]! - base[d]!) / n) as [number, number, number],
        n,
      }
    })
  }

  push(sample: FaceSample, timeMs: number): CheckResult {
    if (this.index < 0 || this.index >= this.steps.length) return { status: 'waiting' }
    if (!sample.looksLikeFace || sample.tooDark) {
      // Hands in the way usually means a move is happening.
      this.movedSinceStep = true
      this.anchor = null
      this.steadySince = null
      return { status: 'no-face' }
    }

    const rgbs = sample.stickers.map((s) => s.rgb)
    // For telling "steady" from "moving", plain colors are enough.
    const labs = sample.stickers.map((s) => s.lab)

    const anchor = this.anchor
    const change = anchor ? Math.max(...labs.map((l, k) => colorDistance(l, anchor[k]!))) : Infinity
    if (change > this.opts.maxChange) {
      if (anchor) this.movedSinceStep = true
      this.anchor = labs
      this.steadySince = timeMs
      return { status: 'moving' }
    }
    this.steadySince ??= timeMs
    if (timeMs - this.steadySince < this.opts.steadyMs) return { status: 'moving' }

    // Steady: which way does the cube look? Each possibility is judged in the
    // light learned from its own middle sticker (a whole-cube turn changes it).
    const byCenter = new Map<StickerColor, Lab[]>()
    const correctedFor = (face: string) => {
      const center = this.colorOf[face[4] as Face]
      let c = byCenter.get(center)
      if (!c) byCenter.set(center, (c = this.corrected(rgbs, center)))
      return c
    }
    const scored = this.candidates()
      .map((c) => ({ c, s: this.score(correctedFor(c.face), c.face) }))
      .sort((a, b) => a.s - b.s)
    const best = scored[0]!
    const sameLook = scored.filter((x) => x.c.face === best.c.face)
    const runnerUp = scored.find((x) => x.c.face !== best.c.face)
    if (best.s > MAX_SCORE || (runnerUp && runnerUp.s < best.s * CLEAR_MARGIN)) {
      return { status: 'unclear' }
    }

    const before = sameLook.some((x) => x.c.kind === 'before')
    const after = sameLook
      .filter((x) => x.c.kind === 'after')
      // If several steps look the same from here, count only the first one.
      .sort((a, b) => a.c.advance! - b.c.advance!)[0]

    this.learn(correctedFor(best.c.face), best.c.face)

    if (after && !before) return { status: 'done', advance: after.c.advance! }
    if (before && after && after.c.advance === 1) {
      // This step doesn't change what the camera sees: trust the user once
      // their hands have moved and the cube is steady again.
      if (this.movedSinceStep) return { status: 'done-unchecked', advance: 1 }
      return { status: 'waiting' }
    }
    if (before) return { status: 'waiting' }

    const wrong = sameLook.find((x) => x.c.kind === 'wrong')
    if (wrong?.c.undo) {
      return { status: 'wrong', undo: wrong.c.undo, undoText: formatMove(wrong.c.undo) }
    }
    return { status: 'unclear' }
  }
}
