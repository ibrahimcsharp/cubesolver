import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  CENTER_FACELETS,
  FACES,
  STANDARD_CENTERS,
  type StickerColor,
  type ValidCube,
} from '@/modules/cube'

/** A sticker is a color, or null while the user hasn't set it yet. */
export type Sticker = StickerColor | null

/** 54 stickers with only the 6 centers filled in (standard holding position). */
export function emptyStickers(): Sticker[] {
  const s: Sticker[] = Array<Sticker>(54).fill(null)
  for (const face of FACES) s[CENTER_FACELETS[face]] = STANDARD_CENTERS[face]
  return s
}

type CubeState = {
  stickers: Sticker[]
  /** The last cube that passed every check, ready to solve. */
  cube: ValidCube | null
  setSticker: (index: number, color: StickerColor) => void
  setAll: (stickers: Sticker[]) => void
  clear: () => void
  setCube: (cube: ValidCube | null) => void
}

// Browser storage can be missing or blocked (private windows); never let that break the app.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value)
    } catch {
      // ignore
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name)
    } catch {
      // ignore
    }
  },
}

export const useCubeStore = create<CubeState>()(
  persist(
    (set) => ({
      stickers: emptyStickers(),
      cube: null,
      setSticker: (index, color) =>
        set((s) => {
          const stickers = [...s.stickers]
          stickers[index] = color
          return { stickers, cube: null }
        }),
      setAll: (stickers) => set({ stickers: [...stickers], cube: null }),
      clear: () => set({ stickers: emptyStickers(), cube: null }),
      setCube: (cube) => set({ cube }),
    }),
    {
      name: 'cubesolver-cube',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // Only the stickers are saved; the checked cube is rebuilt by checking again.
      partialize: (s) => ({ stickers: s.stickers }),
    },
  ),
)
