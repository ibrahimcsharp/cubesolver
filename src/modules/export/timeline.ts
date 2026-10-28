/** The solution as a flat list of steps with everything the exports need to draw them. */
import {
  IDENTITY_ORIENTATION,
  viewFacelets,
  type Face,
  type Orientation,
  type StickerColor,
} from '@/modules/cube'
import type { Solution, Stage, Step, StepGroup } from '@/modules/solution'

export type ExportStep = {
  step: Step
  stage: Stage
  group: StepGroup
  /** The cube as the user sees it before / after this step. */
  before: string
  after: string
  orientationBefore: Orientation
  /** 1-based number among face turns; null for whole-cube turns. */
  moveNumber: number | null
  /** True for the first step of a stage. */
  stageStart: boolean
}

export function exportSteps(solution: Solution): { start: string; items: ExportStep[] } {
  const start = viewFacelets(solution.startFacelets, IDENTITY_ORIENTATION)
  const items: ExportStep[] = []
  let before = start
  let orientation = IDENTITY_ORIENTATION
  let moves = 0
  for (const stage of solution.stages) {
    let first = true
    for (const group of stage.groups) {
      for (const step of group.steps) {
        const after = viewFacelets(step.faceletsAfter, step.orientationAfter)
        items.push({
          step,
          stage,
          group,
          before,
          after,
          orientationBefore: orientation,
          moveNumber: step.kind === 'move' ? ++moves : null,
          stageStart: first,
        })
        first = false
        before = after
        orientation = step.orientationAfter
      }
    }
  }
  return { start, items }
}

export function holdText(o: Orientation, colorOf: Record<Face, StickerColor>): string {
  return `${colorOf[o.U]} on top, ${colorOf[o.F]} facing you`
}

/** Splits text into lines that fit `maxWidth` (measured by `measure`). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (measure(test) > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}
