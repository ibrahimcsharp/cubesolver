/**
 * Sends camera frames to the background worker and gets the results back.
 * Falls back to doing the work on the page if workers aren't available.
 */
import { createFrameAnalyzer, type FrameResult } from './frameAnalyzer'
import type { FrameRequest } from './frame.worker'

export class FrameClient {
  private worker: Worker | null = null
  private fallback = createFrameAnalyzer()
  private nextId = 1
  private pending = new Map<number, (r: FrameResult) => void>()
  private needsReset = false

  constructor() {
    try {
      this.worker = new Worker(new URL('./frame.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent<{ id: number; result: FrameResult }>) => {
        this.pending.get(e.data.id)?.(e.data.result)
        this.pending.delete(e.data.id)
      }
      this.worker.onerror = () => {
        // If the worker fails, carry on without it.
        this.worker?.terminate()
        this.worker = null
        for (const [, resolve] of this.pending) resolve(null as unknown as FrameResult)
        this.pending.clear()
      }
    } catch {
      this.worker = null
    }
  }

  /** Forget where the cube was (e.g. after a capture, to look again fresh). */
  reset(): void {
    this.fallback.reset()
    this.needsReset = true
  }

  /** Analyzes one frame. The frame's pixels are copied, so it can still be used afterwards. */
  analyze(frame: ImageData, timeMs: number): Promise<FrameResult | null> {
    if (!this.worker) return Promise.resolve(this.fallback.analyze(frame, timeMs))
    const id = this.nextId++
    const buffer = frame.data.slice().buffer
    const msg: FrameRequest = {
      id,
      width: frame.width,
      height: frame.height,
      buffer,
      timeMs,
      reset: this.needsReset,
    }
    this.needsReset = false
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.worker!.postMessage(msg, [buffer])
    })
  }

  dispose(): void {
    this.worker?.terminate()
    this.worker = null
    this.pending.clear()
  }
}
