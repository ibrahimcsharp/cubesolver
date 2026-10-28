import { create } from 'zustand'

/** "optimal" = about 20 moves; "beginner" = 7-stage layer-by-layer method. */
export type SolveStyle = 'optimal' | 'beginner'

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
