import { useMemo } from 'react'
import { validateColors, type StickerColor, type ValidCube } from '@/modules/cube'
import { useCubeStore } from './cubeStore'

/** The checked cube, or the saved stickers re-checked after a page reload. */
export function useValidCube(): ValidCube | null {
  const { cube, stickers } = useCubeStore()
  return useMemo(() => {
    if (cube) return cube
    if (stickers.some((s) => s === null)) return null
    const r = validateColors(stickers as StickerColor[])
    return r.ok ? r : null
  }, [cube, stickers])
}
