import {
  Camera,
  CameraOff,
  Check,
  ChevronLeft,
  PartyPopper,
  RefreshCw,
  SkipForward,
  TriangleAlert,
  Volume2,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { capitalize } from '@/components/cube/colors'
import { canUse3D } from '@/components/cube3d/webgl'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { grabFrame, useCamera } from '@/modules/camera/useCamera'
import {
  formatMove,
  IDENTITY_ORIENTATION,
  viewFacelets,
  type Face,
  type Move,
  type Orientation,
  type StickerColor,
} from '@/modules/cube'
import { CAMERA_FACE, cameraArrow, type CameraArrow } from '@/modules/live-guide/camera-view'
import { MoveChecker, type CheckResult } from '@/modules/live-guide/checker'
import { solve } from '@/modules/solve'
import { describeMove, flattenSteps, type Solution, type Step } from '@/modules/solution'
import { centeredBox, sampleFace } from '@/modules/vision'
import { playCaptureSound } from '@/lib/sound'
import { cn } from '@/lib/utils'
import { SPEEDS, useSettingsStore } from '@/store/settingsStore'
import { useValidCube } from '@/store/useValidCube'

const CubePlayer3D = lazy(() => import('@/components/cube3d/CubePlayer3D'))
const HAS_3D = typeof document !== 'undefined' && canUse3D()
const BOX_SHARE = 0.6
const FRAME_INTERVAL_MS = 100

function holdText(o: Orientation, colorOf: Record<Face, StickerColor>) {
  return `${colorOf[o.U]} on top, ${colorOf[o.F]} facing you (${colorOf[o[CAMERA_FACE]]} toward the camera)`
}

export function LivePage() {
  const cube = useValidCube()
  const solveStyle = useSettingsStore((s) => s.solveStyle)
  const solution = useMemo(() => (cube ? solve(cube, solveStyle) : null), [cube, solveStyle])

  if (!cube || !solution) {
    return (
      <section className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">No cube yet</h1>
        <p className="text-muted-foreground">
          Scan your cube or enter its colors first, then come back for the live guide.
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/scan" className={buttonVariants()}>
            Scan my cube
          </Link>
          <Link to="/manual" className={buttonVariants({ variant: 'outline' })}>
            Enter colors by hand
          </Link>
        </div>
      </section>
    )
  }
  return <LiveGuide key={solveStyle} solution={solution} />
}

/** The arrow drawn over the camera picture (in the camera's own, un-mirrored coordinates). */
function ArrowOverlay({ arrow, tone }: { arrow: CameraArrow; tone: 'move' | 'undo' }) {
  const color = tone === 'undo' ? '#f43f5e' : arrow.wholeCube ? '#f59e0b' : '#38bdf8'
  const id = `head-${tone}`
  // Picture units (-1.5…1.5, y up) to SVG (0…300, y down).
  const px = (x: number) => (x + 1.5) * 100
  const py = (y: number) => (1.5 - y) * 100
  return (
    <svg viewBox="0 0 300 300" className="absolute inset-0 size-full overflow-visible" aria-hidden>
      <defs>
        <marker
          id={id}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="3"
          markerHeight="3"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={color} />
        </marker>
      </defs>
      {arrow.kind === 'line' ? (
        <line
          x1={px(arrow.from[0])}
          y1={py(arrow.from[1])}
          x2={px(arrow.to[0])}
          y2={py(arrow.to[1])}
          stroke={color}
          strokeWidth={arrow.wholeCube ? 26 : 16}
          strokeLinecap="round"
          markerEnd={`url(#${id})`}
          opacity={0.9}
        />
      ) : (
        <path
          // A 3/4 circle around the middle, ending with the arrowhead.
          d={arrow.clockwise ? 'M 150 60 A 90 90 0 1 1 60 150' : 'M 150 60 A 90 90 0 1 0 240 150'}
          fill="none"
          stroke={color}
          strokeWidth={arrow.wholeCube ? 22 : 16}
          strokeDasharray={arrow.far ? '18 12' : undefined}
          strokeLinecap="round"
          markerEnd={`url(#${id})`}
          opacity={0.9}
        />
      )}
    </svg>
  )
}

const STATUS_TEXT: Partial<Record<CheckResult['status'], string>> = {
  'no-face': 'Show the cube to the camera, filling the box.',
  moving: 'Watching…',
  waiting: 'Do the move shown, then hold the cube still.',
  unclear: "I can't tell what the cube looks like. Hold it still in the box, upright.",
}

function LiveGuide({ solution }: { solution: Solution }) {
  const steps = useMemo(() => flattenSteps(solution), [solution])
  const views = useMemo(
    () => [
      viewFacelets(solution.startFacelets, IDENTITY_ORIENTATION),
      ...steps.map((s) => viewFacelets(s.faceletsAfter, s.orientationAfter)),
    ],
    [solution, steps],
  )
  const total = steps.length
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [checking, setChecking] = useState(true)
  const [voice, setVoice] = useState(false)
  const [unchecked, setUnchecked] = useState(false)
  const [aspect, setAspect] = useState(16 / 9)
  const speed = useSettingsStore((s) => s.speed)
  const { status: camStatus, error: camError, videoRef, start: startCamera } = useCamera()

  const checkerRef = useRef<MoveChecker | null>(null)
  const loopState = useRef({ index: 0, checking: true, total })
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    checkerRef.current = new MoveChecker(views, steps, solution.colorOf)
  }, [views, steps, solution])

  useEffect(() => {
    loopState.current = { index, checking, total }
    checkerRef.current?.setIndex(index)
  }, [index, checking, total])

  // Read the box ~10 times a second and check the move.
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
      const checker = checkerRef.current
      const st = loopState.current
      if (!video || !checker || !st.checking || st.index >= st.total) return
      const frame = grabFrame(video, canvas)
      if (!frame) return
      setAspect(frame.width / frame.height)
      const r = checker.push(
        sampleFace(frame, centeredBox(frame.width, frame.height, BOX_SHARE)),
        t,
      )
      setResult(r)
      if (r.status === 'done' || r.status === 'done-unchecked') {
        // Move the checker on right away, so the next frame isn't counted again
        // before React has re-rendered.
        const next = Math.min(st.total, st.index + (r.advance ?? 1))
        st.index = next
        checker.setIndex(next)
        playCaptureSound()
        setUnchecked(r.status === 'done-unchecked')
        setIndex(next)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [camStatus, videoRef])

  const step: Step | undefined = steps[index]
  const orientation = index > 0 ? steps[index - 1]!.orientationAfter : IDENTITY_ORIENTATION

  // Read the step aloud when it changes (if turned on).
  useEffect(() => {
    if (!voice || !step || typeof speechSynthesis === 'undefined') return
    speechSynthesis.cancel()
    speechSynthesis.speak(new SpeechSynthesisUtterance(step.text))
  }, [voice, step])

  const go = (i: number) => {
    setUnchecked(false)
    setResult(null)
    setIndex(Math.max(0, Math.min(total, i)))
  }

  const wrongUndo: Move | undefined = result?.status === 'wrong' ? result.undo : undefined
  const arrow = wrongUndo
    ? cameraArrow({ kind: 'move', move: wrongUndo } as Step)
    : step
      ? cameraArrow(step)
      : null
  const done = index >= total
  const moveNumber = steps.slice(0, index).filter((s) => s.kind === 'move').length

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Live guide</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Hold the cube in front of your webcam the normal way. The arrow shows the next turn on
            the side the camera sees, and the app checks each move.
          </p>
        </div>
        <Link to="/solution" className={buttonVariants({ variant: 'ghost' })}>
          <ChevronLeft className="size-4" aria-hidden />
          Back to steps
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3">
          <div
            className="relative overflow-hidden rounded-xl border bg-black"
            style={{ aspectRatio: String(aspect) }}
          >
            {/* Mirrored like a mirror; the arrow is drawn in camera coordinates inside it. */}
            <div className="absolute inset-0 -scale-x-100">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                aria-label="Webcam preview"
              />
              {camStatus === 'live' && (
                <div
                  className={cn(
                    'absolute rounded-lg border-4',
                    result?.status === 'wrong' ? 'border-rose-500' : 'border-white/50',
                  )}
                  style={{
                    width: `${(BOX_SHARE * 100) / aspect}%`,
                    height: `${BOX_SHARE * 100}%`,
                    left: `${50 - (BOX_SHARE * 50) / aspect}%`,
                    top: `${50 - BOX_SHARE * 50}%`,
                  }}
                >
                  {arrow && !done && (
                    <ArrowOverlay arrow={arrow} tone={wrongUndo ? 'undo' : 'move'} />
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
                    <Button onClick={() => startCamera()}>Try again</Button>
                  </>
                ) : (
                  <>
                    <Camera className="size-10" aria-hidden />
                    <p className="max-w-md text-sm text-white/80">
                      Hold the cube with {holdText(orientation, solution.colorOf)}. The camera only
                      watches the side facing it. Nothing is recorded.
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
          <p className="text-muted-foreground text-xs">
            Blue arrow: turn that way. Dashed circle: turn the side facing you. Amber: turn the
            whole cube. Red: undo a wrong turn.
          </p>
        </section>

        <aside className="bg-card h-fit space-y-4 rounded-xl border p-5">
          <div className="space-y-2">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>
                {step
                  ? steps[index] &&
                    solution.stages.find((s) => s.groups.some((g) => g.steps.includes(step)))?.title
                  : 'Done'}
              </span>
              <span className="tabular-nums">
                Move {moveNumber} of {solution.moveCount}
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${(index / Math.max(1, total)) * 100}%` }}
              />
            </div>
          </div>

          {done ? (
            <div className="flex items-center gap-3 text-lg font-medium">
              <PartyPopper className="text-primary size-7" aria-hidden />
              Your cube is solved. Well done!
            </div>
          ) : (
            <>
              <p className="text-sm">
                Hold: <strong>{capitalize(holdText(orientation, solution.colorOf))}</strong>
              </p>
              {wrongUndo ? (
                <div
                  role="alert"
                  className="space-y-1 rounded-lg border border-rose-500/50 bg-rose-500/10 p-3"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <TriangleAlert className="size-4 text-rose-500" aria-hidden />
                    That doesn't look right.
                  </p>
                  <p className="text-sm">
                    Undo it: <code className="font-mono font-bold">{formatMove(wrongUndo)}</code> —{' '}
                    {describeMove(wrongUndo)}.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'flex min-w-20 items-center justify-center rounded-xl px-3 py-2 font-mono text-4xl font-bold',
                      step?.kind === 'move'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-amber-500 text-black',
                    )}
                  >
                    {step?.notation}
                  </span>
                  <p className="text-lg font-medium">{step?.text}</p>
                </div>
              )}

              <p aria-live="polite" className="text-muted-foreground min-h-5 text-sm">
                {!checking
                  ? 'Checking is off. Press "I did it" after each move.'
                  : unchecked && result?.status !== 'wrong'
                    ? "Last move can't be seen from the camera; if it went wrong, press Back."
                    : result && STATUS_TEXT[result.status]}
              </p>
            </>
          )}

          {HAS_3D && !done && (
            <div className="mx-auto w-48">
              <Suspense fallback={null}>
                <CubePlayer3D
                  label="The next move on a 3D cube"
                  views={views}
                  steps={steps}
                  index={index}
                  colorOf={solution.colorOf}
                  quarterMs={SPEEDS[speed]}
                />
              </Suspense>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => go(index - 1)}
              disabled={index === 0}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
            <Button size="sm" onClick={() => go(index + 1)} disabled={done}>
              {checking ? (
                <SkipForward className="size-4" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              {checking ? 'Skip check' : 'I did it'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => go(0)} disabled={index === 0}>
              <RefreshCw className="size-4" aria-hidden />
              Restart
            </Button>
          </div>

          <div className="space-y-2 border-t pt-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={checking}
                onChange={(e) => setChecking(e.target.checked)}
              />
              Check my moves with the camera
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={voice}
                onChange={(e) => setVoice(e.target.checked)}
              />
              <Volume2 className="size-4" aria-hidden />
              Read each move aloud
            </label>
            <p className="text-muted-foreground text-xs">
              Lost track?{' '}
              <Link to="/scan" className="underline">
                Rescan your cube
              </Link>{' '}
              to get a new solution from where it is now.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
