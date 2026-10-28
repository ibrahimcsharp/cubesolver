/**
 * Makes a video of the solution, entirely in the browser (PLAN.md section 9.2).
 *
 * Frames are drawn one by one (3D cube + captions) and encoded with the
 * browser's own video encoder into an MP4 file, much faster than real time.
 * Browsers without that encoder get a WebM recorded in real time instead.
 */
import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
} from 'mediabunny'
import { easeInOut, stepAnimation, turnDuration } from '@/components/cube3d/animation'
import type { Solution } from '@/modules/solution'
import { CubeRenderer } from './cubeRenderer'
import { exportSteps, holdText, wrapText } from './timeline'

export type VideoOptions = {
  /** 720 or 1080 (pixels tall, 16:9). */
  height: 720 | 1080
  /** Milliseconds for a quarter turn. */
  quarterMs: number
  /** Pause after each move, in milliseconds. */
  pauseMs: number
  onProgress?: (share: number) => void
  signal?: AbortSignal
}

export type VideoResult = { blob: Blob; extension: 'mp4' | 'webm'; seconds: number }

const FPS = 30
const BG = '#0f1115'
const TEXT = '#f2f4f7'
const MUTED = '#9aa3b2'
const ACCENT = '#22c55e'
const AMBER = '#f59e0b'
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** One stretch of the video; `draw` paints it at time t (0..duration seconds). */
type Segment = { duration: number; draw: (t: number) => void }

export class ExportCancelled extends Error {}

export async function makeSolutionVideo(
  solution: Solution,
  opts: VideoOptions,
): Promise<VideoResult> {
  const H = opts.height
  const W = Math.round((H * 16) / 9)
  const s = H / 720 // scale for sizes
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const cubeSize = Math.round(H * 0.82)
  const cube = new CubeRenderer(cubeSize)
  const { start, items } = exportSteps(solution)
  const colorOf = solution.colorOf
  const totalMoves = solution.moveCount

  // ----- drawing helpers -----
  const text = (t: string, x: number, y: number, size: number, color = TEXT, weight = 400) => {
    ctx.font = `${weight} ${size * s}px ${FONT}`
    ctx.fillStyle = color
    ctx.fillText(t, x, y)
  }
  const paragraph = (
    t: string,
    x: number,
    y: number,
    width: number,
    size: number,
    color = TEXT,
    lineGap = 1.35,
  ) => {
    ctx.font = `400 ${size * s}px ${FONT}`
    ctx.fillStyle = color
    const lines = wrapText(t, width, (str) => ctx.measureText(str).width)
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * s * lineGap))
    return y + lines.length * size * s * lineGap
  }
  const background = () => {
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, W, H)
  }
  const drawCube = (x: number) =>
    ctx.drawImage(cube.render(), x, (H - cubeSize) / 2, cubeSize, cubeSize)
  const progressBar = (done: number) => {
    ctx.fillStyle = '#262b36'
    ctx.fillRect(0, H - 8 * s, W, 8 * s)
    ctx.fillStyle = ACCENT
    ctx.fillRect(0, H - 8 * s, (W * done) / Math.max(1, totalMoves), 8 * s)
  }
  const panelX = W * 0.56
  const panelW = W * 0.4

  // ----- the timeline -----
  const segments: Segment[] = []

  // Intro: the scrambled cube, slowly turning.
  segments.push({
    duration: 3.5,
    draw: (t) => {
      background()
      cube.setStickers(start, colorOf)
      cube.setTurn(null, 0)
      cube.setArrow(null)
      cube.setSpin(Math.sin(t * 0.9) * 0.35)
      drawCube(W * 0.04)
      cube.setSpin(0)
      text("Your cube's solution", panelX, H * 0.3, 44, TEXT, 700)
      text(
        solution.style === 'beginner'
          ? `Beginner method · ${totalMoves} moves`
          : `Fast solution · ${totalMoves} moves`,
        panelX,
        H * 0.3 + 56 * s,
        24,
        MUTED,
      )
      paragraph(
        `Hold your cube with ${holdText(solution.startOrientation, colorOf)}, like the picture.`,
        panelX,
        H * 0.5,
        panelW,
        28,
      )
    },
  })

  for (const item of items) {
    // Stage title card (beginner method).
    if (item.stageStart && solution.style === 'beginner') {
      segments.push({
        duration: 2.2,
        draw: () => {
          background()
          cube.setStickers(item.before, colorOf)
          cube.setTurn(null, 0)
          cube.setArrow(null)
          ctx.globalAlpha = 0.35
          drawCube(W * 0.04)
          ctx.globalAlpha = 1
          text(item.stage.title, panelX, H * 0.36, 40, TEXT, 700)
          paragraph(item.stage.goal, panelX, H * 0.36 + 60 * s, panelW, 26, MUTED)
          progressBar((item.moveNumber ?? 1) - 1)
        },
      })
    }

    const anim = stepAnimation(item.step)
    const turn = turnDuration(anim, opts.quarterMs) / 1000
    const lead = 0.5 // show the arrow before turning
    const pause = opts.pauseMs / 1000
    const done = (item.moveNumber ?? 0) - (item.step.kind === 'move' ? 1 : 0)
    segments.push({
      duration: lead + turn + pause,
      draw: (t) => {
        background()
        cube.setStickers(item.before, colorOf)
        const turning = t >= lead
        const p = turning ? easeInOut(Math.min(1, (t - lead) / turn)) : 0
        if (t >= lead + turn) {
          // Finished: show the cube after the move (its new hold, at rest).
          cube.setStickers(item.after, colorOf)
          cube.setTurn(null, 0)
          cube.setArrow(null)
        } else {
          cube.setTurn(turning ? anim : null, p)
          cube.setArrow(turning ? null : anim)
        }
        drawCube(W * 0.04)

        const isMove = item.step.kind === 'move'
        text(item.stage.title, panelX, H * 0.14, 22, MUTED)
        // Big notation badge.
        const badge = isMove ? item.step.notation : 'Turn cube'
        ctx.font = `700 ${(isMove ? 96 : 52) * s}px ui-monospace, Menlo, Consolas, monospace`
        const bw = Math.max(150 * s, ctx.measureText(badge).width + 48 * s)
        ctx.fillStyle = isMove ? ACCENT : AMBER
        ctx.beginPath()
        ctx.roundRect(panelX, H * 0.2, bw, 130 * s, 18 * s)
        ctx.fill()
        ctx.fillStyle = '#0b0d10'
        ctx.textBaseline = 'middle'
        ctx.fillText(badge, panelX + 24 * s, H * 0.2 + 66 * s)
        ctx.textBaseline = 'alphabetic'

        let y = paragraph(item.step.text, panelX, H * 0.2 + 185 * s, panelW, 32, TEXT)
        y = paragraph(item.group.explanation, panelX, y + 22 * s, panelW, 22, MUTED)
        if (item.group.algorithm)
          text(`Pattern: ${item.group.algorithm}`, panelX, y + 20 * s, 20, MUTED)

        const n = item.moveNumber ?? done
        text(`Move ${isMove ? n : done} of ${totalMoves}`, W - 230 * s, H - 30 * s, 20, MUTED)
        progressBar(isMove && t >= lead + turn ? n : done)
      },
    })
  }

  // Ending: solved cube spinning.
  const finalView = items.at(-1)?.after ?? start
  segments.push({
    duration: 3.5,
    draw: (t) => {
      background()
      cube.setStickers(finalView, colorOf)
      cube.setTurn(null, 0)
      cube.setArrow(null)
      cube.setSpin(t * 1.2)
      drawCube(W * 0.04)
      cube.setSpin(0)
      text('Solved!', panelX, H * 0.42, 72, ACCENT, 800)
      text('Well done.', panelX, H * 0.42 + 60 * s, 30, TEXT)
      progressBar(totalMoves)
    },
  })

  const totalSeconds = segments.reduce((a, b) => a + b.duration, 0)
  const totalFrames = Math.ceil(totalSeconds * FPS)

  /** Draws frame number f of the whole video. */
  const drawFrame = (f: number) => {
    let t = f / FPS
    for (const seg of segments) {
      if (t < seg.duration || seg === segments.at(-1)) {
        seg.draw(Math.min(t, seg.duration))
        return
      }
      t -= seg.duration
    }
  }

  try {
    const codec =
      typeof VideoEncoder !== 'undefined'
        ? await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H })
        : null

    if (codec) {
      const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
      const source = new CanvasSource(canvas, { codec, bitrate: QUALITY_HIGH })
      output.addVideoTrack(source, { frameRate: FPS })
      await output.start()
      for (let f = 0; f < totalFrames; f++) {
        if (opts.signal?.aborted) {
          await output.cancel()
          throw new ExportCancelled()
        }
        drawFrame(f)
        await source.add(f / FPS, 1 / FPS)
        if (f % 15 === 0) opts.onProgress?.(f / totalFrames)
      }
      await output.finalize()
      const buffer = (output.target as BufferTarget).buffer!
      opts.onProgress?.(1)
      return {
        blob: new Blob([buffer], { type: 'video/mp4' }),
        extension: 'mp4',
        seconds: totalSeconds,
      }
    }

    // Fallback: record the canvas in real time.
    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    recorder.start(1000)
    const started = performance.now()
    for (let f = 0; f < totalFrames; f++) {
      if (opts.signal?.aborted) {
        recorder.stop()
        throw new ExportCancelled()
      }
      drawFrame(f)
      const due = started + ((f + 1) * 1000) / FPS
      await new Promise((r) => setTimeout(r, Math.max(0, due - performance.now())))
      if (f % 15 === 0) opts.onProgress?.(f / totalFrames)
    }
    recorder.stop()
    await new Promise((r) => (recorder.onstop = r))
    opts.onProgress?.(1)
    return {
      blob: new Blob(chunks, { type: 'video/webm' }),
      extension: 'webm',
      seconds: totalSeconds,
    }
  } finally {
    cube.dispose()
  }
}
