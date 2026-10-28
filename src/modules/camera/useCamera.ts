/**
 * Webcam access: start/stop, pick a camera, and friendly error messages.
 * The video never leaves the browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error'

export type CameraState = {
  status: CameraStatus
  error: string | null
  devices: MediaDeviceInfo[]
  deviceId: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  start: (deviceId?: string) => Promise<void>
  stop: () => void
}

function explain(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Click the camera icon in the address bar to allow it, then try again. You can also upload photos or enter the colors by hand.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Plug in a webcam, or upload photos or enter the colors by hand.'
    case 'NotReadableError':
    case 'AbortError':
      return 'The camera is busy, probably in another app (like a video call). Close that app and try again.'
    default:
      return 'The camera could not be started. Try again, or upload photos instead.'
  }
}

export function useCamera(): CameraState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
  }, [])

  const start = useCallback(async (wanted?: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('This browser cannot use the camera. Try a recent Chrome, Edge, Firefox or Safari.')
      return
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    setStatus('starting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(wanted ? { deviceId: { exact: wanted } } : { facingMode: 'user' }),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => undefined)
      }
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? null)
      // Camera names are only available after permission is given.
      const all = await navigator.mediaDevices.enumerateDevices()
      setDevices(all.filter((d) => d.kind === 'videoinput'))
      setStatus('live')
    } catch (e) {
      setStatus('error')
      setError(explain(e))
    }
  }, [])

  // Always release the camera when leaving the page.
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), [])

  return { status, error, devices, deviceId, videoRef, start, stop }
}

/** Copies the current video frame into pixels (not mirrored). */
export function grabFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  maxWidth = 640,
): ImageData | null {
  const w0 = video.videoWidth
  const h0 = video.videoHeight
  if (!w0 || !h0) return null
  const scale = Math.min(1, maxWidth / w0)
  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}
