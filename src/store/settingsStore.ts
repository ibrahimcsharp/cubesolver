import { create } from 'zustand'
import type { SolveStyle } from '@/modules/solution'

export type { SolveStyle }

type SettingsState = {
  solveStyle: SolveStyle
  setSolveStyle: (style: SolveStyle) => void
  toggleSolveStyle: () => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  solveStyle: 'beginner',
  setSolveStyle: (solveStyle) => set({ solveStyle }),
  toggleSolveStyle: () =>
    set((s) => ({ solveStyle: s.solveStyle === 'optimal' ? 'beginner' : 'optimal' })),
}))
