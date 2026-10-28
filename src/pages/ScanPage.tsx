import { Camera, CameraOff, Check, Lightbulb, RotateCcw, Upload } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { capitalize, STICKER_FILL } from '@/components/cube/colors'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { faceThumbnail } from '@/modules/camera/thumbnail'
import { grabFrame, useCamera } from '@/modules/camera/useCamera'
import { SCAN_ORDER, type StickerColor } from '@/modules/cube'
import {
  AUTO_CAPTURE_HINT,
  AutoCapture,
  centeredBox,
  nearestNominal,
  sampleFace,
  type AutoCaptureResult,
  type FaceSample,
} from '@/modules/vision'
import { playCaptureSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useScanStore } from '@/store/scanStore'

const BOX_SHARE = 0.6
const FRAME_INTERVAL_MS = 100

type Live = {
  sample: FaceSample
  guesses: StickerColor[]
  /** What automatic capture thinks of this frame (when it is on). */
  auto: AutoCaptureResult | null
  /** Box position as % of the frame. */
  box: { left: number; top: number; size: number; sizeY: number }
}

export function ScanPage() {
  const navigate = useNavigate()
  const {
    status: camStatus,
    error: camError,
    devices,
    deviceId,
    videoRef,
    start: startCamera,
    stop: stopCamera,
  } = useCamera()
  const { faces, setFace, reset, finish } = useScanStore()
  const [live, setLive] = useState<Live | null>(null)
  const [aspect, setAspect] = useState(16 / 9)
  const [flash, setFlash] = useState(false)
  const [autoOn, setAutoOn] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const latest = useRef<{ live: Live; frame: ImageData } | null>(null)
  const autoRef = useRef<AutoCapture | null>(null)
  // The frame loop runs outside React, so it reads the latest values from refs.
  const stateRef = useRef({ step: 0, allDone: false, autoOn: true, scanned: [] as StickerColor[] })
  const captureRef = useRef<() => void>(() => undefined)

  const step = Math.max(
    0,
    faces.findIndex((f) => f === null),
  )
  const allDone = faces.every((f) => f !== null)
  const current = SCAN_ORDER[allDone ? 5 : step]!

  // Start fresh each time the page opens.
  useEffect(() => {
    reset()
    autoRef.current = new AutoCapture()
  }, [reset])

  useEffect(() => {
    stateRef.current = {
      step,
      allDone,
      autoOn,
      scanned: SCAN_ORDER.filter((_, i) => faces[i]).map((s) => s.front),
    }
  }, [step, allDone, autoOn, faces])

  // Read the guide box about 10 times a second.
  useEffect(() => {
    if (camStatus !== 'live') return
    let raf = 0
    let last = 0
    const canvas = (canvasRef.current ??= document.createElement('canvas'))
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < FRAME_INTERVAL_MS) return
      last = t
      const video = videoRef.current
      if (!video) return
      const frame = grabFrame(video, canvas)
      if (!frame) return
      setAspect(frame.width / frame.height)
      const box = centeredBox(frame.width, frame.height, BOX_SHARE)
      const sample = sampleFace(frame, box)
      const st = stateRef.current
      const auto =
        st.autoOn && !st.allDone && autoRef.current
          ? autoRef.current.push(sample, t, SCAN_ORDER[st.step]!.front, st.scanned)
          : null
      const next: Live = {
        sample,
        auto,
        guesses: sample.stickers.map((s) => nearestNominal(s.lab)),
        box: {
          left: (box.x / frame.width) * 100,
          top: (box.y / frame.height) * 100,
          size: (box.size / frame.width) * 100,
          sizeY: (box.size / frame.height) * 100,
        },
      }
      latest.current = { live: next, frame }
      setLive(next)
      if (auto?.status === 'capture') captureRef.current()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [camStatus, videoRef])

  const capture = useCallback(() => {
    const got = latest.current
    if (!got || allDone) return
    const { frame, live: l } = got
    const box = centeredBox(frame.width, frame.height, BOX_SHARE)
    setFace(step, {
      rgbs: l.sample.stickers.map((s) => s.rgb),
      // Small picture of the face as the camera sees it (from outside the cube).
      thumbnail: faceThumbnail(frame, box),
    })
    playCaptureSound()
    navigator.vibrate?.(40)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 250)
  }, [allDone, setFace, step])

  useEffect(() => {
    captureRef.current = capture
  }, [capture])

  const retake = (i: number) => {
    autoRef.current?.forget(SCAN_ORDER[i]!.front)
    setFace(i, null)
  }

  // Space bar captures.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && camStatus === 'live') {
        e.preventDefault()
        capture()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [camStatus, capture])

  const readCube = () => {
    finish('scan')
    stopCamera()
    navigate('/check')
  }

  const centerGuess = live?.guesses[4]
  const autoStatus = autoOn ? live?.auto?.status : undefined
  const wrongSide = autoOn
    ? autoStatus === 'wrong-side'
    : !!live?.sample.looksLikeFace && centerGuess !== current.front
  const ready = !!live?.sample.looksLikeFace && !live.sample.glare && !live.sample.tooDark
  const progress = autoOn ? (live?.auto?.progress ?? 0) : 0

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Scan your cube</h1>
        <p className="text-muted-foreground text-sm">
          Show each of the 6 sides to your webcam, in the order shown. Your camera feed stays on
          this computer.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          <div
            className="relative overflow-hidden rounded-xl border bg-black"
            style={{ aspectRatio: String(aspect) }}
          >
            {/* Mirrored like a mirror, so moving the cube feels natural. */}
            <div className="absolute inset-0 -scale-x-100">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                aria-label="Webcam preview"
              />
              {live && (
                <div
                  className={cn(
                    'absolute grid grid-cols-3 grid-rows-3 rounded-lg border-4 transition-colors',
                    ready ? 'border-green-400' : 'border-amber-400',
                    flash && 'bg-white/60',
                  )}
                  style={{
                    left: `${live.box.left}%`,
                    top: `${live.box.top}%`,
                    width: `${live.box.size}%`,
                    height: `${live.box.sizeY}%`,
                  }}
                  aria-hidden
                >
                  {live.guesses.map((g, i) => (
                    <div key={i} className="flex items-end justify-end border border-white/25 p-1">
                      <span
                        className="size-3 rounded-sm border border-black/40 sm:size-4"
                        style={{ background: STICKER_FILL[g] }}
                      />
                    </div>
                  ))}
                  {progress > 0 && (
                    <div className="absolute inset-x-0 -bottom-3 h-1.5 overflow-hidden rounded-full bg-black/50">
                      <div
                        className="ml-auto h-full bg-green-400 transition-[width] duration-100"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {camStatus !== 'live' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
                {camStatus === 'error' ? (
                  <>
                    <CameraOff className="size-10 text-amber-400" aria-hidden />
                    <p role="alert" className="max-w-md text-sm">
                      {camError}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button onClick={() => startCamera()}>Try again</Button>
                      <Link to="/upload" className={buttonVariants({ variant: 'outline' })}>
                        Upload photos
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <Camera className="size-10" aria-hidden />
                    <p className="max-w-md text-sm text-white/80">
                      We use your webcam only to read the sticker colors. Nothing is recorded or
                      uploaded.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => startCamera()}
                      disabled={camStatus === 'starting'}
                    >
                      {camStatus === 'starting' ? 'Starting camera…' : 'Turn on camera'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {devices.length > 1 && (
            <label className="flex items-center gap-2 text-sm">
              Camera:
              <select
                className="bg-card rounded-md border px-2 py-1"
                value={deviceId ?? ''}
                onChange={(e) => startCamera(e.target.value)}
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <li className="flex items-center gap-1">
              <Lightbulb className="size-3.5" aria-hidden /> Face a window or lamp; avoid light
              behind you
            </li>
            <li>Hold the cube 25–40 cm from the camera</li>
            <li>Hold it by the edges; fill the box</li>
          </ul>
        </section>

        <aside className="bg-card h-fit space-y-5 rounded-xl border p-5">
          <ol className="flex gap-2" aria-label="Scan progress">
            {SCAN_ORDER.map((s, i) => (
              <li key={s.front}>
                <button
                  type="button"
                  onClick={() => retake(i)}
                  disabled={!faces[i]}
                  title={faces[i] ? `Retake the ${s.front} side` : `${capitalize(s.front)} side`}
                  aria-label={
                    faces[i]
                      ? `Retake the ${s.front} side`
                      : `${capitalize(s.front)} side, not scanned yet`
                  }
                  className={cn(
                    'relative flex size-10 items-center justify-center overflow-hidden rounded-md border-2',
                    i === step && !allDone ? 'border-primary' : 'border-transparent',
                    faces[i] && 'hover:opacity-80',
                  )}
                  style={{ background: STICKER_FILL[s.front] }}
                >
                  {faces[i] ? (
                    <>
                      <img
                        src={faces[i]!.thumbnail}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                      />
                      <Check
                        className="relative size-5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-hidden
                      />
                    </>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>

          {allDone ? (
            <div className="space-y-3">
              <p className="font-medium">All 6 sides scanned.</p>
              <p className="text-muted-foreground text-sm">
                Tap a side above to retake it, or read the cube now.
              </p>
              <Button size="lg" className="w-full" onClick={readCube}>
                Read my cube
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">Step {step + 1} of 6</p>
              <div className="flex gap-4 text-sm">
                <Swatch color={current.front} label="Facing camera" />
                <Swatch color={current.top} label="On top" />
              </div>
              <p className="text-base">{current.instruction}</p>

              <div aria-live="polite" className="min-h-10 space-y-1 text-sm">
                {camStatus === 'live' && autoStatus && autoStatus !== 'wrong-side' && (
                  <p
                    className={cn(
                      autoStatus === 'steadying' || autoStatus === 'capture'
                        ? 'text-green-500'
                        : autoStatus === 'too-dark' || autoStatus === 'glare'
                          ? 'text-amber-500'
                          : 'text-muted-foreground',
                    )}
                  >
                    {AUTO_CAPTURE_HINT[autoStatus]}
                  </p>
                )}
                {!autoOn && camStatus === 'live' && live?.sample.tooDark && (
                  <p className="text-amber-500">Too dark. Turn on a light or face a window.</p>
                )}
                {!autoOn && camStatus === 'live' && live?.sample.glare && (
                  <p className="text-amber-500">Glare on the stickers. Tilt the cube a little.</p>
                )}
                {!autoOn &&
                  camStatus === 'live' &&
                  live &&
                  !live.sample.looksLikeFace &&
                  !live.sample.tooDark && (
                    <p className="text-muted-foreground">Fill the box with one side of the cube.</p>
                  )}
                {wrongSide && (
                  <p className="text-amber-500">
                    The middle looks {centerGuess}. This step needs {current.front} facing the
                    camera.
                  </p>
                )}
                {!autoOn && camStatus === 'live' && ready && !wrongSide && (
                  <p className="text-green-500">Looks good. Hold still and capture.</p>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoOn}
                  onChange={(e) => setAutoOn(e.target.checked)}
                  className="size-4"
                />
                Capture automatically when the cube is held still
              </label>

              <Button
                size="lg"
                className="w-full"
                onClick={capture}
                disabled={camStatus !== 'live'}
              >
                <Camera className="size-4" aria-hidden />
                {autoOn ? 'Capture now (Space)' : 'Capture (Space)'}
              </Button>
              {step > 0 && (
                <Button variant="ghost" size="sm" onClick={() => retake(step - 1)}>
                  <RotateCcw className="size-4" aria-hidden />
                  Redo the last side
                </Button>
              )}
            </div>
          )}

          <p className="text-muted-foreground border-t pt-4 text-xs">
            No webcam?{' '}
            <Link to="/upload" className="underline">
              <Upload className="mr-0.5 inline size-3" aria-hidden />
              Upload photos
            </Link>{' '}
            or{' '}
            <Link to="/manual" className="underline">
              enter the colors by hand
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  )
}

function Swatch({ color, label }: { color: StickerColor; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="size-7 rounded-md border border-black/20"
        style={{ background: STICKER_FILL[color] }}
        aria-hidden
      />
      <span>
        <span className="text-muted-foreground block text-xs">{label}</span>
        {capitalize(color)}
      </span>
    </div>
  )
}
