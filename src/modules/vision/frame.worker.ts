/// <reference lib="webworker" />
/**
 * Background worker for scanning: finds the cube and reads its colors off
 * the page's main thread, so the camera view stays smooth.
 */
import { createFrameAnalyzer } from './frameAnalyzer'

export type FrameRequest = {
  id: number
  width: number
  height: number
  buffer: ArrayBuffer
  timeMs: number
  reset?: boolean
}

const analyzer = createFrameAnalyzer()

self.onmessage = (e: MessageEvent<FrameRequest>) => {
  const { id, width, height, buffer, timeMs, reset } = e.data
  if (reset) analyzer.reset()
  const result = analyzer.analyze({ data: new Uint8ClampedArray(buffer), width, height }, timeMs)
  self.postMessage({ id, result })
}
