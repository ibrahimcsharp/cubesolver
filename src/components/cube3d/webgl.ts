/** True if this browser can draw 3D (WebGL). Kept apart so it doesn't load three.js. */
export function canUse3D(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}
