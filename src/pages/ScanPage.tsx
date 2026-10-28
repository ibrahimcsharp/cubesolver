import {
  Camera,
  CameraOff,
  Check,
  Flashlight,
  Lightbulb,
  RotateCcw,
  Sun,
  Upload,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { capitalize, STICKER_FILL } from '@/components/cube/colors'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { faceThumbnail } from '@/modules/camera/thumbnail'
import { grabFrame, useCamera } from '@/modules/camera/useCamera'
import { SCAN_ORDER, validateColors, type StickerColor } from '@/modules/cube'
import {
  AUTO_CAPTURE_HINT,
  AutoCapture,
  FrameClient,
  LiveColors,
  type AutoCaptureResult,
  type Box,
  type FaceSample,
  type RGB,
} from '@/modules/vision'
import { playCaptureSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { useCubeStore } from '@/store/cubeStore'
import { useScanStore } from '@/store/scanStore'

/** About 15 looks a second; the work happens in a background worker. */
const FRAME_INTERVAL_MS = 66
/** Frames averaged for a manual capture (cancels camera grain in low light). */
const MANUAL_FRAMES = 6

type Live = {
  sample: FaceSample
  guesses: StickerColor[]
  /** What automatic capture thinks of this frame (when it is on). */
  auto: AutoCaptureResult | null
  /** Box position as % of the frame. */
  box: { left: number; top: number; size: number; sizeY: number }
}

/** Average of several frames' 9 colors. */
function averageFrames(frames: readonly RGB[][]): RGB[] {
  return Array.from(
    { length: 9 },
    (_, i) =>
      [0, 1, 2].map(
        (k) => frames.reduce((s, f) => s + f[i]![k]!, 0) / frames.length,
      ) as unknown as RGB,
  )
}

export function ScanPage() {
  const navigate = useNavigate()
  const {
    status: camStatus,
    error: camError,
    devices,
    deviceId,
    videoRef,
    controls,
    setBrightness,
    setTorch,
    start: startCamera,
    stop: stopCamera,
  } = useCamera()
  const { faces, setFace, reset, finish } = useScanStore()
  const [live, setLive] = useState<Live | null>(null)
  const [aspect, setAspect] = useState(16 / 9)
  const [flash, setFlash] = useState(false)
  const [autoOn, setAutoOn] = useState(true)
  const [screenLight, setScreenLight] = useState(false)
  const [refused, setRefused] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const latest = useRef<{ live: Live; frame: ImageData; box: Box } | null>(null)
  const recent = useRef<RGB[][]>([])
  /** Live color guesses that learn this room's light from captured sides. */
  const colorsRef = useRef(new LiveColors())
  const [reading, setReading] = useState(false)
  const readCubeRef = useRef<() => void>(() => undefined)
  const autoRef = useRef<AutoCapture | null>(null)
  // The frame loop runs outside React, so it reads the latest values from refs.
  const stateRef = useRef({ allDone: false, autoOn: true })
  const captureRef = useRef<(rgbs?: RGB[]) => void>(() => undefined)

  const slot = Math.max(
    0,
    faces.findIndex((f) => f === null),
  )
  const count = faces.filter(Boolean).length
  const allDone = count === 6

  // Suggest a side not shown yet (only a suggestion: any order works).
  const shownColors = useMemo(
    () => new LiveColors().learn(faces.flatMap((f) => (f ? [f.rgbs[4]!] : []))),
    [faces],
  )
  const suggestion = SCAN_ORDER.find((s) => !shownColors.includes(s.front)) ?? SCAN_ORDER[count]!

  // Start fresh each time the page opens.
  useEffect(() => {
    reset()
    autoRef.current = new AutoCapture()
  }, [reset])

  useEffect(() => {
    stateRef.current = { allDone, autoOn }
  }, [allDone, autoOn])

  // Each captured side teaches the live color dots what its color looks like here.
  useEffect(() => {
    colorsRef.current.learn(faces.flatMap((f) => (f ? [f.rgbs[4]!] : [])))
  }, [faces])

  // Screen light: a bright white page lights the cube from the front.
  useEffect(() => {
    const root = document.documentElement
    if (screenLight) root.setAttribute('data-screen-light', '')
    else root.removeAttribute('data-screen-light')
    return () => root.removeAttribute('data-screen-light')
  }, [screenLight])

  // Look at the camera about 15 times a second. Finding the cube and reading
  // its colors happens in a background worker, so the page stays smooth.
  useEffect(() => {
    if (camStatus !== 'live') return
    const client = new FrameClient()
    let raf = 0
    let last = 0
    let busy = false
    let stopped = false
    const canvas = (canvasRef.current ??= document.createElement('canvas'))
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (busy || t - last < FRAME_INTERVAL_MS) return
      const video = videoRef.current
      if (!video) return
      const frame = grabFrame(video, canvas)
      if (!frame) return
      last = t
      busy = true
      void client.analyze(frame, t).then((res) => {
        busy = false
        if (stopped || !res) return
        const { sample, box } = res
        setAspect(frame.width / frame.height)
        recent.current = [...recent.current, sample.stickers.map((x) => x.rgb)].slice(
          -MANUAL_FRAMES,
        )
        const st = stateRef.current
        // Any side not captured yet is accepted; the cube is worked out at the end.
        const auto =
          st.autoOn && !st.allDone && autoRef.current ? autoRef.current.push(sample, t) : null
        const next: Live = {
          sample,
          auto,
          guesses: sample.stickers.map((x) => colorsRef.current.guess(x.rgb)),
          box: {
            left: (box.x / frame.width) * 100,
            top: (box.y / frame.height) * 100,
            size: (box.size / frame.width) * 100,
            sizeY: (box.size / frame.height) * 100,
          },
        }
        latest.current = { live: next, frame, box }
        setLive(next)
        if (auto?.status === 'capture') captureRef.current(auto.rgbs)
      })
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      client.dispose()
    }
  }, [camStatus, videoRef])

  /** Saves a side: the averaged colors from auto-capture, or the last few frames averaged. */
  const capture = useCallback(
    (rgbs?: RGB[]) => {
      const got = latest.current
      if (!got || allDone) return
      // Don't save something that isn't a cube side (a wall, a hand, a cube
      // only half in view): it would make the whole cube unreadable.
      if (!rgbs && !got.live.sample.looksLikeFace) {
        setRefused(true)
        window.setTimeout(() => setRefused(false), 2500)
        return
      }
      const { frame, box } = got
      setFace(slot, {
        rgbs: rgbs ?? averageFrames(recent.current),
        // Small picture of the face as the camera sees it (from outside the cube).
        thumbnail: faceThumbnail(frame, box),
      })
      playCaptureSound()
      navigator.vibrate?.(40)
      setFlash(true)
      window.setTimeout(() => setFlash(false), 250)
      // That was the last side: read the cube straight away.
      if (count + 1 === 6) {
        setReading(true)
        window.setTimeout(() => readCubeRef.current(), 450)
      }
    },
    [allDone, count, setFace, slot],
  )

  useEffect(() => {
    captureRef.current = capture
  }, [capture])

  const retake = (i: number) => {
    const face = faces[i]
    if (face) autoRef.current?.forgetSide(face.rgbs)
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

  /**
   * Reads the cube. If it is clearly right, go straight to the solution;
   * otherwise open the Check screen to look it over.
   */
  const readCube = () => {
    const result = finish('scan')
    stopCamera()
    const valid = validateColors(result.colors)
    if (valid.ok && result.uncertain.length === 0 && result.suspects.length === 0) {
      useCubeStore.getState().setCube(valid)
      navigate('/solution')
    } else {
      navigate('/check')
    }
  }
  useEffect(() => {
    readCubeRef.current = readCube
  })

  const autoStatus = autoOn ? live?.auto?.status : undefined
  const ready = !!live?.sample.looksLikeFace && !live.sample.glare && !live.sample.tooDark
  const progress = autoOn ? (live?.auto?.progress ?? 0) : 0

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Scan your cube</h1>
        <p className="text-muted-foreground text-sm">
          Show each of the 6 sides to your webcam. Any order and any way up is fine; the app works
          out which side is which. Your camera feed stays on this computer.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          <div
            className={cn(
              'relative overflow-hidden rounded-xl border bg-black',
              screenLight && 'ring-[24px] ring-white',
            )}
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
                    // Glide to the cube's position instead of jumping there.
                    'absolute grid grid-cols-3 grid-rows-3 rounded-lg border-4 transition-[left,top,width,height,border-color] duration-200 ease-out',
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
                      {/* Color dots only when a cube side is in view (no flicker otherwise). */}
                      {live.sample.looksLikeFace && (
                        <span
                          className="size-3 rounded-sm border border-black/40 sm:size-4"
                          style={{ background: STICKER_FILL[g] }}
                        />
                      )}
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Button
              variant={screenLight ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setScreenLight((on) => !on)}
              aria-pressed={screenLight}
            >
              <Sun className="size-4" aria-hidden />
              Screen light {screenLight ? 'on' : 'off'}
            </Button>
            {controls.torch !== undefined && (
              <Button
                variant={controls.torch ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setTorch(!controls.torch)}
                aria-pressed={controls.torch}
              >
                <Flashlight className="size-4" aria-hidden />
                Light {controls.torch ? 'on' : 'off'}
              </Button>
            )}
            {controls.brightness && (
              <label className="flex items-center gap-2">
                Camera brightness
                <input
                  type="range"
                  min={controls.brightness.min}
                  max={controls.brightness.max}
                  step={controls.brightness.step}
                  value={controls.brightness.value}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                />
                {controls.brightness.value !== controls.brightness.initial && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setBrightness(controls.brightness!.initial)}
                  >
                    Reset
                  </Button>
                )}
              </label>
            )}
            {devices.length > 1 && (
              <label className="flex items-center gap-2">
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
          </div>

          <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-xs">
            <li className="flex items-center gap-1">
              <Lightbulb className="size-3.5" aria-hidden /> Face a window or lamp; in a dark room,
              turn on Screen light
            </li>
            <li>Hold the cube 25–40 cm from the camera</li>
            <li>Hold it by the edges; fill the box</li>
          </ul>
        </section>

        <aside className="bg-card h-fit space-y-5 rounded-xl border p-5">
          <ol className="flex gap-2" aria-label="Scan progress">
            {faces.map((face, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => retake(i)}
                  disabled={!face}
                  title={face ? `Retake side ${i + 1}` : `Side ${i + 1}`}
                  aria-label={face ? `Retake side ${i + 1}` : `Side ${i + 1}, not scanned yet`}
                  className={cn(
                    'bg-muted relative flex size-10 items-center justify-center overflow-hidden rounded-md border-2',
                    i === slot && !allDone ? 'border-primary' : 'border-transparent',
                    face && 'hover:opacity-80',
                  )}
                >
                  {face ? (
                    <>
                      <img
                        src={face.thumbnail}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                      />
                      <Check
                        className="relative size-5 rounded-full bg-black/60 p-0.5 text-white"
                        aria-hidden
                      />
                    </>
                  ) : (
                    <span className="text-muted-foreground text-xs">{i + 1}</span>
                  )}
                </button>
              </li>
            ))}
          </ol>

          {allDone ? (
            <div className="space-y-3">
              <p className="font-medium">
                {reading ? 'Reading your cube…' : 'All 6 sides scanned.'}
              </p>
              <p className="text-muted-foreground text-sm">
                Tap a side above to retake it, or read the cube now.
              </p>
              <Button size="lg" className="w-full" onClick={readCube}>
                Read my cube
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-xs">{count} of 6 sides scanned</p>
              <div className="flex gap-4 text-sm">
                <Swatch color={suggestion.front} label="Next, show" />
                <Swatch color={suggestion.top} label="On top (if you can)" />
              </div>
              <p className="text-base">{suggestion.instruction}</p>
              <p className="text-muted-foreground text-xs">
                A different side or a different way up is fine too.
              </p>

              <div aria-live="polite" className="min-h-10 space-y-1 text-sm">
                {refused && (
                  <p className="text-amber-500">
                    I can't see a whole cube side yet, so nothing was saved. Hold one side flat to
                    the camera, close enough to fill the box.
                  </p>
                )}
                {camStatus === 'live' && autoStatus && (
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
                  <p className="text-amber-500">Too dark. Turn on a light or Screen light.</p>
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
                {!autoOn && camStatus === 'live' && ready && (
                  <p className="text-green-500">Looks good. Hold still and capture.</p>
                )}
                {camStatus === 'live' && live?.sample.dim && !screenLight && (
                  <p className="text-muted-foreground">
                    It's a bit dark. Turn on <strong>Screen light</strong> or a lamp for steadier
                    colors.
                  </p>
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
                onClick={() => capture()}
                disabled={camStatus !== 'live'}
              >
                <Camera className="size-4" aria-hidden />
                {autoOn ? 'Capture now (Space)' : 'Capture (Space)'}
              </Button>
              {count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => retake(faces.findLastIndex((f) => f !== null))}
                >
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
