import { COLORS, type StickerColor } from '@/modules/cube'

/** Fill colors for stickers (CSS variables defined in index.css). */
export const STICKER_FILL: Record<StickerColor, string> = {
  white: 'var(--sticker-white)',
  yellow: 'var(--sticker-yellow)',
  green: 'var(--sticker-green)',
  blue: 'var(--sticker-blue)',
  red: 'var(--sticker-red)',
  orange: 'var(--sticker-orange)',
}

export const EMPTY_FILL = 'var(--sticker-empty)'

/** Keyboard shortcut for each color in the picker. */
export const COLOR_KEYS: Record<StickerColor, string> = {
  white: '1',
  yellow: '2',
  green: '3',
  blue: '4',
  red: '5',
  orange: '6',
}

export const PICKER_ORDER: readonly StickerColor[] = [
  'white',
  'yellow',
  'green',
  'blue',
  'red',
  'orange',
]

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export { COLORS }

/** The same sticker colors as hex, for the 3D cube (WebGL can't read CSS variables). */
export const STICKER_HEX: Record<StickerColor, string> = {
  white: '#f5f5f5',
  yellow: '#ffd500',
  green: '#009b48',
  blue: '#0046ad',
  red: '#b71234',
  orange: '#ff5800',
}
