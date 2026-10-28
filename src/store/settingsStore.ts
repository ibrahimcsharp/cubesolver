import { create } from 'zustand'
import type { SolveStyle } from '@/modules/solution'

export type { SolveStyle }

/** How the cube is drawn on the solution screen. */
export type CubeView = '3d' | 'flat'

/** Animation speed: milliseconds for one quarter turn. */
export const SPEEDS = { slow: 900, normal: 450, fast: 200 } as const
export type Speed = keyof typeof SPEEDS

type SettingsState = {
  solveStyle: SolveStyle
  cubeView: CubeView
  speed: Speed
  setSolveStyle: (style: SolveStyle) => void
  toggleSolveStyle: () => void
  setCubeView: (view: CubeView) => void
  setSpeed: (speed: Speed) => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  solveStyle: 'beginner',
  cubeView: '3d',
  speed: 'normal',
  setSolveStyle: (solveStyle) => set({ solveStyle }),
  toggleSolveStyle: () =>
    set((s) => ({ solveStyle: s.solveStyle === 'optimal' ? 'beginner' : 'optimal' })),
  setCubeView: (cubeView) => set({ cubeView }),
  setSpeed: (speed) => set({ speed }),
}))
