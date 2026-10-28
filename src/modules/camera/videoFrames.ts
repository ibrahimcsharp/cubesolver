/**
 * Steps through an uploaded video file, a few frames per second, and hands
 * back each frame's pixels. Runs in the browser; the video is never uploaded.
 */
import { grabFrame } from './useCamera'

export const MAX_VIDEO_SECONDS = 180

export type VideoFrame = { frame: ImageData; timeMs: number; progress: number }

function once(target: EventTarget, event: string, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('timeout'))
    }, timeoutMs)
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('error'))
    }
    const cleanup = () => {
      window.clearTimeout(timer)
      target.removeEventListener(event, onEvent)
      target.removeEventListener('error', onError)
    }
    target.addEventListener(event, onEvent)
    target.addEventListener('error', onError)
  })
}

async function seek(video: HTMLVideoElement, seconds: number): Promise<void> {
  const done = once(video, 'seeked')
  video.currentTime = seconds
  await done
}

export class VideoError extends Error {}

export async function* readVideoFrames(
  file: File,
  {
    fps = 6,
    maxWidth = 480,
    signal,
  }: { fps?: number; maxWidth?: number; signal?: AbortSignal } = {},
): AsyncGenerator<VideoFrame> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  const canvas = document.createElement('canvas')
  try {
    const loaded = once(video, 'loadeddata', 15000)
    video.src = url
    try {
      await loaded
    } catch {
      throw new VideoError('This video could not be opened. Try an MP4 or WebM file.')
    }

    // Some recordings (e.g. from browsers) don't store their length; seeking
    // far past the end makes the browser work it out.
    if (!Number.isFinite(video.duration)) {
      await seek(video, 1e7).catch(() => undefined)
      await seek(video, 0)
    }
    const duration = video.duration
    if (!Number.isFinite(duration) || duration <= 0)
      throw new VideoError('This video seems to be empty.')
    if (duration > MAX_VIDEO_SECONDS)
      throw new VideoError(
        `This video is ${Math.round(duration)} seconds long. Please use one under ${MAX_VIDEO_SECONDS / 60} minutes.`,
      )

    const times: number[] = []
    for (let t = 0; t < duration; t += 1 / fps) times.push(t)
    // Always include the very end: people often hold the last side until they stop recording.
    const end = Math.max(0, duration - 0.05)
    if (end - times.at(-1)! > 0.05) times.push(end)

    for (const t of times) {
      if (signal?.aborted) return
      try {
        await seek(video, t)
      } catch {
        continue // skip a frame the browser couldn't reach
      }
      const frame = grabFrame(video, canvas, maxWidth)
      if (frame) yield { frame, timeMs: t * 1000, progress: Math.min(1, t / duration) }
    }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}
