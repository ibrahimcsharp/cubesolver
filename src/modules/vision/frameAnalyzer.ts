/**
 * Everything done to one camera frame during a scan: find the cube (follow
 * it from the last frame; search the whole picture only when it's lost) and
 * read its 9 colors. Runs in a Web Worker in the app (frame.worker.ts) so the
 * page stays smooth, and directly in tests.
 */
import { findFaceBox, findFaceBoxNear } from './gridFinder'
import { centeredBox, sampleFace, type Box, type FaceSample, type Pixels } from './sample'

export type FrameResult = {
  /** Where the 9 stickers were read. */
  box: Box
  /** How the box was found: following the cube, a full search, or the fixed middle box. */
  how: 'tracked' | 'found' | 'middle'
  sample: FaceSample
}

/** Don't search the whole picture more often than this while the cube is lost. */
const FULL_SEARCH_EVERY_MS = 300
/** A found cube smaller than this share of the picture is ignored (too far away). */
const MIN_SIZE = 0.16

export function createFrameAnalyzer() {
  let last: Box | null = null
  let lastFullSearch = -Infinity

  return {
    reset() {
      last = null
      lastFullSearch = -Infinity
    },

    analyze(img: Pixels, timeMs: number): FrameResult {
      const minSide = Math.min(img.width, img.height)
      let box: Box | null = null
      let how: FrameResult['how'] = 'middle'

      if (last) {
        const near = findFaceBoxNear(img, last)
        if (near && near.box.size >= minSide * MIN_SIZE) {
          box = near.box
          how = 'tracked'
        }
      }
      if (!box && timeMs - lastFullSearch >= FULL_SEARCH_EVERY_MS) {
        lastFullSearch = timeMs
        const found = findFaceBox(img)
        if (found && found.box.size >= minSide * MIN_SIZE) {
          box = found.box
          how = 'found'
        }
      }
      box ??= centeredBox(img.width, img.height, 0.6)

      const sample = sampleFace(img, box)
      // Keep following only something that really looks like a cube side.
      last = how !== 'middle' && sample.looksLikeFace ? box : null
      return { box, how, sample }
    },
  }
}

export type FrameAnalyzer = ReturnType<typeof createFrameAnalyzer>
