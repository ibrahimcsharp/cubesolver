import type { Box } from '@/modules/vision'

/** A small square picture of the box area of a frame (as the camera saw it). */
export function faceThumbnail(frame: ImageData, box: Box, size = 96): string {
  const src = document.createElement('canvas')
  src.width = frame.width
  src.height = frame.height
  src.getContext('2d')?.putImageData(frame, 0, 0)
  const thumb = document.createElement('canvas')
  thumb.width = thumb.height = size
  thumb.getContext('2d')?.drawImage(src, box.x, box.y, box.size, box.size, 0, 0, size, size)
  return thumb.toDataURL('image/jpeg', 0.8)
}
