/**
 * Webcam access: start/stop, pick a camera, and friendly error messages.
 * The video never leaves the browser.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'live' | 'error'

/** A camera setting the user can change, if this camera supports it. */
export type RangeControl = { min: number; max: number; step: number; value: number }

/** Extra controls some cameras offer (most laptop webcams offer brightness; phones a torch). */
export type CameraControls = {
  brightness?: RangeControl & { name: 'brightness' | 'exposureCompensation' }
  torch?: boolean
}

export type CameraState = {
  status: CameraStatus
  error: string | null
  devices: MediaDeviceInfo[]
  deviceId: string | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  controls: CameraControls
  setBrightness: (value: number) => void
  setTorch: (on: boolean) => void
  start: (deviceId?: string) => Promise<void>
  stop: () => void
}

// Not all browsers' type definitions know these camera settings yet.
type ExtraCapabilities = MediaTrackCapabilities & {
  brightness?: { min: number; max: number; step?: number }
  exposureCompensation?: { min: number; max: number; step?: number }
  exposureMode?: string[]
  whiteBalanceMode?: string[]
  torch?: boolean
}
type ExtraSettings = MediaTrackSettings & {
  brightness?: number
  exposureCompensation?: number
  torch?: boolean
}

/** Reads which extra controls the camera has, and turns on automatic exposure/white balance. */
async function setUpTrack(track: MediaStreamTrack): Promise<CameraControls> {
  const caps = (track.getCapabilities?.() ?? {}) as ExtraCapabilities
  const settings = track.getSettings() as ExtraSettings
  const auto: Record<string, string> = {}
  if (caps.exposureMode?.includes('continuous')) auto.exposureMode = 'continuous'
  if (caps.whiteBalanceMode?.includes('continuous')) auto.whiteBalanceMode = 'continuous'
  if (Object.keys(auto).length)
    await track
      .applyConstraints({ advanced: [auto as MediaTrackConstraintSet] })
      .catch(() => undefined)

  const controls: CameraControls = {}
  const range = caps.exposureCompensation ?? caps.brightness
  if (range && range.max > range.min) {
    const name = caps.exposureCompensation ? 'exposureCompensation' : 'brightness'
    controls.brightness = {
      name,
      min: range.min,
      max: range.max,
      step: range.step || (range.max - range.min) / 100,
      value:
        (name === 'exposureCompensation' ? settings.exposureCompensation : settings.brightness) ??
        (range.min + range.max) / 2,
    }
  }
  if (caps.torch) controls.torch = !!settings.torch
  return controls
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
  const [controls, setControls] = useState<CameraControls>({})

  const track = () => streamRef.current?.getVideoTracks()[0]
  const setBrightness = useCallback((value: number) => {
    setControls((c) => {
      if (!c.brightness) return c
      track()
        ?.applyConstraints({
          advanced: [{ [c.brightness.name]: value } as MediaTrackConstraintSet],
        })
        .catch(() => undefined)
      return { ...c, brightness: { ...c.brightness, value } }
    })
  }, [])
  const setTorch = useCallback((on: boolean) => {
    track()
      ?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      .catch(() => undefined)
    setControls((c) => ({ ...c, torch: on }))
  }, [])

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
      const videoTrack = stream.getVideoTracks()[0]
      setDeviceId(videoTrack?.getSettings().deviceId ?? null)
      setControls(videoTrack ? await setUpTrack(videoTrack) : {})
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

  return {
    status,
    error,
    devices,
    deviceId,
    videoRef,
    controls,
    setBrightness,
    setTorch,
    start,
    stop,
  }
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
