import {
  Box,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Pause,
  PartyPopper,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Video,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { capitalize } from '@/components/cube/colors'
import { CubeNet } from '@/components/cube/CubeNet'
import { stepAnimation, turnDuration } from '@/components/cube3d/animation'
import { canUse3D } from '@/components/cube3d/webgl'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import {
  FACES,
  IDENTITY_ORIENTATION,
  viewFacelets,
  type Face,
  type Orientation,
  type StickerColor,
} from '@/modules/cube'
import { solve } from '@/modules/solve'
import type { Solution, SolveStyle, Stage, Step, StepGroup } from '@/modules/solution'
import { cn } from '@/lib/utils'
import { SPEEDS, useSettingsStore, type Speed } from '@/store/settingsStore'
import { useValidCube } from '@/store/useValidCube'

// three.js is large, so the 3D cube is only downloaded when it is shown.
const CubePlayer3D = lazy(() => import('@/components/cube3d/CubePlayer3D'))
const HAS_3D = typeof document !== 'undefined' && canUse3D()
const PAUSE_BETWEEN_MOVES_MS = 350

const VIEW_LABELS: Record<Face, string> = {
  U: 'Top',
  L: 'Left',
  F: 'Front',
  R: 'Right',
  B: 'Back',
  D: 'Bottom',
}

type FlatStep = {
  step: Step
  stage: Stage
  group: StepGroup
  stageIndex: number
  groupKey: string
  /** 1-based number among face turns; null for whole-cube turns. */
  moveNumber: number | null
}

function flatten(solution: Solution): FlatStep[] {
  const out: FlatStep[] = []
  let moves = 0
  solution.stages.forEach((stage, si) =>
    stage.groups.forEach((group, gi) =>
      group.steps.forEach((step) => {
        out.push({
          step,
          stage,
          group,
          stageIndex: si,
          groupKey: `${si}-${gi}`,
          moveNumber: step.kind === 'move' ? ++moves : null,
        })
      }),
    ),
  )
  return out
}

export function SolutionPage() {
  const cube = useValidCube()
  const solveStyle = useSettingsStore((s) => s.solveStyle)
  const setSolveStyle = useSettingsStore((s) => s.setSolveStyle)

  const result = useMemo(() => {
    if (!cube) return null
    try {
      return { solution: solve(cube, solveStyle) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }, [cube, solveStyle])

  if (!cube) {
    return (
      <section className="mx-auto max-w-xl space-y-4 text-center">
        <h1 className="text-2xl font-semibold">No cube yet</h1>
        <p className="text-muted-foreground">
          Scan your cube or enter its colors first, then come back here for the solution.
        </p>
        <div className="flex justify-center gap-2">
          <Link to="/manual" className={buttonVariants()}>
            Enter colors by hand
          </Link>
          <Link to="/scan" className={buttonVariants({ variant: 'outline' })}>
            Scan my cube
          </Link>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your solution</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/live" className={buttonVariants({ variant: 'outline' })}>
            <Video className="size-4" aria-hidden />
            Live guide (webcam)
          </Link>
          <StyleToggle value={solveStyle} onChange={setSolveStyle} />
        </div>
      </div>

      {result && 'error' in result && (
        <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
          Something went wrong while solving: {result.error}
        </p>
      )}
      {result && 'solution' in result && result.solution && (
        <SolutionView key={solveStyle} solution={result.solution} />
      )}
    </div>
  )
}

function StyleToggle({
  value,
  onChange,
}: {
  value: SolveStyle
  onChange: (s: SolveStyle) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Solution style"
      className="inline-flex rounded-lg border p-1"
    >
      {(['beginner', 'optimal'] as const).map((style) => (
        <button
          key={style}
          type="button"
          role="radio"
          aria-checked={value === style}
          onClick={() => onChange(style)}
          className={cn(
            'rounded-md px-4 py-1.5 text-sm',
            value === style ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          {style === 'beginner' ? 'Beginner (Learn)' : 'Optimal (Fast)'}
        </button>
      ))}
    </div>
  )
}

function holdText(o: Orientation, colorOf: Record<Face, StickerColor>) {
  return `${capitalize(colorOf[o.U])} on top, ${colorOf[o.F]} facing you`
}

function SolutionView({ solution }: { solution: Solution }) {
  const steps = useMemo(() => flatten(solution), [solution])
  const total = steps.length
  // index = the step about to be done; index === total means finished.
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const { cubeView, setCubeView, speed, setSpeed } = useSettingsStore()
  const show3D = HAS_3D && cubeView === '3d'
  const quarterMs = SPEEDS[speed]
  const go = (i: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(total, i)))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight') {
        setPlaying(false)
        setIndex((i) => Math.min(total, i + 1))
      }
      if (e.key === 'ArrowLeft') {
        setPlaying(false)
        setIndex((i) => Math.max(0, i - 1))
      }
      if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [total])

  // Play: do the next move once the last one has finished turning.
  useEffect(() => {
    if (!playing) return
    const last = steps[index - 1]
    const turning = last && show3D ? turnDuration(stepAnimation(last.step), quarterMs) : 0
    const timer = window.setTimeout(() => {
      if (index >= total) setPlaying(false)
      else setIndex(index + 1)
    }, turning + PAUSE_BETWEEN_MOVES_MS)
    return () => window.clearTimeout(timer)
  }, [playing, index, total, steps, quarterMs, show3D])

  // What the user sees at every point (for the 3D cube).
  const views = useMemo(
    () => [
      viewFacelets(solution.startFacelets, IDENTITY_ORIENTATION),
      ...steps.map((s) => viewFacelets(s.step.faceletsAfter, s.step.orientationAfter)),
    ],
    [solution, steps],
  )
  const plainSteps = useMemo(() => steps.map((s) => s.step), [steps])

  const current = steps[index]
  const prev = steps[index - 1]
  const facelets = prev ? prev.step.faceletsAfter : solution.startFacelets
  const orientation = prev ? prev.step.orientationAfter : IDENTITY_ORIENTATION
  const seen = viewFacelets(facelets, orientation)
  const seenColors = [...seen].map((ch) => solution.colorOf[ch as Face])

  // Highlight the face the user is about to turn (as they see it).
  const focus = useMemo(() => {
    if (current?.step.kind !== 'move') return undefined
    const f = FACES.indexOf(current.step.move.face)
    return new Set(Array.from({ length: 9 }, (_, i) => f * 9 + i))
  }, [current])

  if (total === 0) {
    return (
      <div className="bg-card flex items-center gap-3 rounded-xl border p-6">
        <PartyPopper className="text-primary size-6" aria-hidden />
        <p>This cube is already solved. Nothing to do!</p>
      </div>
    )
  }

  const movesDone = prev ? steps.slice(0, index).filter((s) => s.moveNumber).length : 0

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {solution.moveCount} moves
        {solution.style === 'beginner' &&
          ` in ${solution.stages.filter((s) => s.id !== 'flip' && s.id !== 'finish').length} stages`}
        . Go step by step, or press Play to watch it all.
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Current step" className="bg-card space-y-5 rounded-xl border p-5">
          <div className="space-y-2">
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{current ? current.stage.title : 'Done'}</span>
              <span className="tabular-nums">
                Move {movesDone} of {solution.moveCount}
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className="bg-primary h-full transition-all"
                style={{ width: `${(index / total) * 100}%` }}
              />
            </div>
          </div>

          {index === 0 && (
            <p className="rounded-lg bg-sky-500/10 p-3 text-sm">
              <strong>Start:</strong> hold the cube with{' '}
              {holdText(IDENTITY_ORIENTATION, solution.colorOf).toLowerCase()}.
            </p>
          )}

          {current ? (
            <div className="space-y-3">
              <p className="text-sm">{current.group.explanation}</p>
              <div className="flex items-center gap-4">
                <span
                  className={cn(
                    'flex min-w-24 items-center justify-center rounded-xl px-4 py-3 font-mono text-4xl font-bold sm:text-5xl',
                    current.step.kind === 'move'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-amber-500 text-black',
                  )}
                >
                  {current.step.kind === 'move' ? (
                    current.step.notation
                  ) : current.step.rotation === "y'" ? (
                    <RotateCw className="size-10" aria-label="Turn the whole cube" />
                  ) : (
                    <RotateCcw className="size-10" aria-label="Turn the whole cube" />
                  )}
                </span>
                <p className="text-lg font-medium">{current.step.text}</p>
              </div>
              {current.group.algorithm && (
                <p className="text-muted-foreground text-xs">
                  Pattern: <code className="font-mono">{current.group.algorithm}</code>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-lg font-medium">
              <PartyPopper className="text-primary size-7" aria-hidden />
              Your cube is solved. Well done!
            </div>
          )}

          <div className="space-y-2">
            <p className="text-muted-foreground text-xs">
              {current ? 'Your cube should look like this now' : 'Solved cube'} (held with{' '}
              {holdText(orientation, solution.colorOf).toLowerCase()}).
              {current &&
                (show3D
                  ? ' The blue arrow shows the next turn. Drag the cube to look around.'
                  : current.step.kind === 'move' && ' The face to turn is outlined.')}
            </p>
            {show3D ? (
              <div className="mx-auto max-w-md">
                <Suspense
                  fallback={
                    <div className="text-muted-foreground flex aspect-square items-center justify-center text-sm">
                      Loading 3D cube…
                    </div>
                  }
                >
                  <CubePlayer3D
                    label={
                      '3D cube held with ' + holdText(orientation, solution.colorOf).toLowerCase()
                    }
                    views={views}
                    steps={plainSteps}
                    index={index}
                    colorOf={solution.colorOf}
                    quarterMs={quarterMs}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="mx-auto max-w-md">
                <CubeNet
                  label="Cube as you are holding it"
                  stickers={seenColors}
                  faceLabels={VIEW_LABELS}
                  highlight={focus}
                  highlightTone="focus"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
            <Button onClick={() => go(index + 1)} disabled={index === total}>
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
            <Button
              variant="outline"
              onClick={() => setPlaying((p) => !p)}
              disabled={index === total}
              aria-pressed={playing}
            >
              {playing ? (
                <Pause className="size-4" aria-hidden />
              ) : (
                <Play className="size-4" aria-hidden />
              )}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button variant="ghost" onClick={() => go(0)} disabled={index === 0}>
              <RefreshCw className="size-4" aria-hidden />
              Start over
            </Button>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              Speed
              <select
                className="bg-card text-foreground rounded-md border px-2 py-1"
                value={speed}
                onChange={(e) => setSpeed(e.target.value as Speed)}
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </label>
            {HAS_3D && (
              <div
                role="radiogroup"
                aria-label="Cube view"
                className="inline-flex rounded-lg border p-0.5"
              >
                {(
                  [
                    ['3d', '3D', Box],
                    ['flat', 'Flat map', Grid3x3],
                  ] as const
                ).map(([value, text, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={cubeView === value}
                    onClick={() => setCubeView(value)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1',
                      cubeView === value ? 'bg-muted text-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {text}
                  </button>
                ))}
              </div>
            )}
            <span className="hidden text-xs sm:inline">Keys: ← → step, Space play/pause</span>
          </div>
        </section>

        <StepList steps={steps} index={index} onSelect={go} />
      </div>
    </div>
  )
}

function StepList({
  steps,
  index,
  onSelect,
}: {
  steps: FlatStep[]
  index: number
  onSelect: (i: number) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [index])

  // Group the flat list back into stages and groups for display.
  const stages: { stage: Stage; groups: { group: StepGroup; items: number[] }[] }[] = []
  steps.forEach((s, i) => {
    let st = stages.at(-1)
    if (!st || st.stage !== s.stage) {
      st = { stage: s.stage, groups: [] }
      stages.push(st)
    }
    let g = st.groups.at(-1)
    if (!g || g.group !== s.group) {
      g = { group: s.group, items: [] }
      st.groups.push(g)
    }
    g.items.push(i)
  })

  return (
    <nav
      aria-label="All steps"
      className="bg-card max-h-[70vh] space-y-5 overflow-y-auto rounded-xl border p-4 lg:max-h-[calc(100vh-10rem)]"
    >
      {stages.map(({ stage, groups }) => (
        <section key={stage.id} className="space-y-2">
          <h2 className="text-sm font-semibold">{stage.title}</h2>
          <p className="text-muted-foreground text-xs">{stage.goal}</p>
          {groups.map(({ group, items }) => (
            <div key={items[0]} className="space-y-1.5 border-l-2 pl-3">
              <p className="text-xs">{group.explanation}</p>
              <div className="flex flex-wrap gap-1">
                {items.map((i) => {
                  const s = steps[i]!
                  const active = i === index
                  const done = i < index
                  return (
                    <button
                      key={i}
                      ref={active ? activeRef : undefined}
                      type="button"
                      onClick={() => onSelect(i)}
                      title={s.step.text}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'min-w-9 rounded-md border px-1.5 py-0.5 font-mono text-sm',
                        s.step.kind === 'rotation' && 'border-amber-500/60',
                        active && 'bg-primary text-primary-foreground border-primary',
                        done && !active && 'text-muted-foreground opacity-60',
                        !active && 'hover:bg-muted',
                      )}
                    >
                      {s.step.kind === 'rotation' ? `⟳${s.step.notation}` : s.step.notation}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </nav>
  )
}
