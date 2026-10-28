/**
 * Results of a camera scan or photo upload, kept until the user has checked
 * them. Not saved across reloads (photos can be large).
 */
import { create } from 'zustand'
import type { StickerColor } from '@/modules/cube'
import { reconstructCube, type RGB } from '@/modules/vision'
import { useCubeStore } from './cubeStore'

export type CapturedFace = {
  /** Colors (sRGB) of the 9 cells, row by row as the camera saw them. */
  rgbs: RGB[]
  /** Small picture of the face, for the Check screen. */
  thumbnail: string
}

type ScanState = {
  /** Up to 6 captured sides, in any order and any way up. */
  faces: (CapturedFace | null)[]
  /** Which color side each capture turned out to be (after reading). */
  sides: StickerColor[] | null
  /** Sticker indices the user should double-check. */
  uncertain: number[]
  /** Where the current result came from, for the Check screen's back link. */
  source: 'scan' | 'upload' | null
  setFace: (slot: number, face: CapturedFace | null) => void
  reset: () => void
  /** Reads all 6 sides, fills the cube map, and marks uncertain stickers. */
  finish: (source: 'scan' | 'upload') => void
  markChecked: (index: number) => void
}

export const useScanStore = create<ScanState>()((set, get) => ({
  faces: Array(6).fill(null),
  sides: null,
  uncertain: [],
  source: null,
  setFace: (slot, face) =>
    set((s) => {
      const faces = [...s.faces]
      faces[slot] = face
      return { faces }
    }),
  reset: () => set({ faces: Array(6).fill(null), sides: null, uncertain: [], source: null }),
  finish: (source) => {
    const { faces } = get()
    if (faces.some((f) => !f)) throw new Error('All 6 sides are needed')
    const result = reconstructCube(faces.map((f) => f!.rgbs))
    useCubeStore.getState().setAll(result.colors)
    set({ source, sides: result.sides, uncertain: result.uncertain })
  },
  markChecked: (index) => set((s) => ({ uncertain: s.uncertain.filter((i) => i !== index) })),
}))
