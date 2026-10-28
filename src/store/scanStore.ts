/**
 * Results of a camera scan or photo upload, kept until the user has checked
 * them. Not saved across reloads (photos can be large).
 */
import { create } from 'zustand'
import {
  CENTER_FACELETS,
  FACES,
  STANDARD_CENTERS,
  type Face,
  type StickerColor,
} from '@/modules/cube'
import { classifyStickers, LOW_CONFIDENCE, SCAN_STEP_FACELETS, type RGB } from '@/modules/vision'
import { useCubeStore } from './cubeStore'

export type CapturedFace = {
  /** Colors (sRGB) of the 9 cells, row by row as the camera saw them. */
  rgbs: RGB[]
  /** Small picture of the face, for the Check screen. */
  thumbnail: string
}

type ScanState = {
  faces: (CapturedFace | null)[]
  /** Sticker indices the user should double-check. */
  uncertain: number[]
  /** Where the current result came from, for the Check screen's back link. */
  source: 'scan' | 'upload' | null
  setFace: (step: number, face: CapturedFace | null) => void
  reset: () => void
  /** Reads all 6 faces, fills the cube map, and marks uncertain stickers. */
  finish: (source: 'scan' | 'upload') => void
  markChecked: (index: number) => void
}

export const useScanStore = create<ScanState>()((set, get) => ({
  faces: Array(6).fill(null),
  uncertain: [],
  source: null,
  setFace: (step, face) =>
    set((s) => {
      const faces = [...s.faces]
      faces[step] = face
      return { faces }
    }),
  reset: () => set({ faces: Array(6).fill(null), uncertain: [], source: null }),
  finish: (source) => {
    const { faces } = get()
    const rgbs: RGB[] = Array(54)
    faces.forEach((face, step) => {
      if (!face) throw new Error('All 6 faces are needed')
      SCAN_STEP_FACELETS[step]!.forEach((facelet, cell) => (rgbs[facelet] = face.rgbs[cell]!))
    })
    const centers = Object.fromEntries(FACES.map((f) => [f, STANDARD_CENTERS[f]])) as Record<
      Face,
      StickerColor
    >
    const result = classifyStickers(rgbs, centers)
    const centerSet = new Set(Object.values(CENTER_FACELETS))
    useCubeStore.getState().setAll(result.colors)
    set({
      source,
      uncertain: result.confidence.flatMap((c, i) =>
        c < LOW_CONFIDENCE && !centerSet.has(i) ? [i] : [],
      ),
    })
  },
  markChecked: (index) => set((s) => ({ uncertain: s.uncertain.filter((i) => i !== index) })),
}))
