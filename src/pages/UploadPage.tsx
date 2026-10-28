import { Film, ImagePlus, RotateCw, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { capitalize, STICKER_FILL } from '@/components/cube/colors'
import { Button } from '@/components/ui/button'
import { readVideoFrames, VideoError } from '@/modules/camera/videoFrames'
import { SCAN_ORDER } from '@/modules/cube'
import {
  AutoCapture,
  centeredBox,
  findFaceBox,
  nearestNominal,
  reconstructCube,
  rgbToLab,
  sampleFace,
  type Box,
  type RGB,
} from '@/modules/vision'
import { cn } from '@/lib/utils'
import { useScanStore } from '@/store/scanStore'

const MAX_SIDE = 800

type Photo = {
  pixels: ImageData
  url: string
  box: Box
  autoFound: boolean
  /** From a video: colors averaged over the frames the side was held still. */
  rgbs?: RGB[]
}

async function loadPhoto(file: File): Promise<Photo> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return withBox(ctx.getImageData(0, 0, canvas.width, canvas.height), canvas)
}

function withBox(pixels: ImageData, canvas: HTMLCanvasElement): Photo {
  const found = findFaceBox(pixels)
  return {
    pixels,
    url: canvas.toDataURL('image/jpeg', 0.85),
    box: found?.box ?? centeredBox(pixels.width, pixels.height, 0.6),
    autoFound: !!found,
  }
}

/** A video frame as a photo, with the box where the cube was found. */
function photoFromFrame(frame: ImageData, box: Box, rgbs?: RGB[]): Photo {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  canvas.getContext('2d')!.putImageData(frame, 0, 0)
  return { pixels: frame, url: canvas.toDataURL('image/jpeg', 0.85), box, autoFound: true, rgbs }
}

/**
 * Puts sides found in a video into the matching color slots. With all 6, the
 * full cube reading decides which is which; otherwise the middle color's best guess.
 */
function intoSlots(found: Photo[]): (Photo | null)[] {
  const slots: (Photo | null)[] = Array(6).fill(null)
  const colors =
    found.length === 6
      ? reconstructCube(found.map((f) => f.rgbs!)).sides
      : found.map((f) => nearestNominal(rgbToLab(f.rgbs![4]!)))
  const leftovers: Photo[] = []
  found.forEach((photo, k) => {
    const slot = SCAN_ORDER.findIndex((st) => st.front === colors[k])
    if (slot >= 0 && !slots[slot]) slots[slot] = photo
    else leftovers.push(photo)
  })
  for (const photo of leftovers) slots[slots.indexOf(null)] = photo
  return slots
}

type VideoProgress = { progress: number; found: number }

/**
 * Goes through the video and keeps one frame per side, using the same
 * automatic capture as the live webcam scan: steady, and a side not seen yet
 * (in any order, any way up).
 */
async function sidesFromVideo(
  file: File,
  onProgress: (p: VideoProgress) => void,
  signal: AbortSignal,
): Promise<(Photo | null)[]> {
  const auto = new AutoCapture({ steadyMs: 500 })
  const found: Photo[] = []
  for await (const { frame, timeMs, progress } of readVideoFrames(file, { signal })) {
    if (found.length >= 6) break
    const box = findFaceBox(frame)?.box ?? centeredBox(frame.width, frame.height, 0.6)
    const result = auto.push(sampleFace(frame, box), timeMs)
    if (result.status === 'capture') found.push(photoFromFrame(frame, box, result.rgbs))
    onProgress({ progress, found: found.length })
    // Let the page repaint between frames.
    await new Promise((r) => setTimeout(r, 0))
  }
  return intoSlots(found)
}

/** Turns the photo a quarter turn clockwise. */
function rotatePhoto(p: Photo): Photo {
  const src = document.createElement('canvas')
  src.width = p.pixels.width
  src.height = p.pixels.height
  src.getContext('2d')!.putImageData(p.pixels, 0, 0)
  const dst = document.createElement('canvas')
  dst.width = src.height
  dst.height = src.width
  const ctx = dst.getContext('2d', { willReadFrequently: true })!
  ctx.translate(dst.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(src, 0, 0)
  return withBox(ctx.getImageData(0, 0, dst.width, dst.height), dst)
}

function thumbnail(p: Photo): string {
  const src = document.createElement('canvas')
  src.width = p.pixels.width
  src.height = p.pixels.height
  src.getContext('2d')!.putImageData(p.pixels, 0, 0)
  const t = document.createElement('canvas')
  t.width = t.height = 96
  t.getContext('2d')!.drawImage(src, p.box.x, p.box.y, p.box.size, p.box.size, 0, 0, 96, 96)
  return t.toDataURL('image/jpeg', 0.8)
}

export function UploadPage() {
  const navigate = useNavigate()
  const { setFace, reset, finish } = useScanStore()
  const [photos, setPhotos] = useState<(Photo | null)[]>(Array(6).fill(null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [video, setVideo] = useState<VideoProgress | null>(null)
  const [videoResult, setVideoResult] = useState<string | null>(null)
  const multiRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const addVideo = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setVideoResult(null)
    const abort = new AbortController()
    abortRef.current = abort
    setVideo({ progress: 0, found: 0 })
    try {
      const found = await sidesFromVideo(file, setVideo, abort.signal)
      if (abort.signal.aborted) return
      setPhotos((all) => all.map((p, i) => found[i] ?? p))
      const count = found.filter(Boolean).length
      setVideoResult(
        count === 6
          ? 'Found all 6 sides in the video. Check the boxes below, then read your cube.'
          : `Found ${count} of 6 sides. Add a photo for each empty slot below, or try another video holding each side still for a second.`,
      )
    } catch (e) {
      setError(
        e instanceof VideoError ? e.message : 'Something went wrong while reading the video.',
      )
    } finally {
      setVideo(null)
    }
  }

  useEffect(() => reset(), [reset])

  const setPhoto = (i: number, p: Photo | null) =>
    setPhotos((all) =>
      all.map((x, k) => {
        if (k !== i) return x
        // Colors saved from a video no longer apply once the box is moved.
        return p && x && p.rgbs && p.box !== x.box ? { ...p, rgbs: undefined } : p
      }),
    )

  /** Fills empty slots in order with the chosen files. */
  const addFiles = async (files: FileList | null, startAt?: number) => {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      const loaded = await Promise.all([...files].map(loadPhoto))
      setPhotos((all) => {
        const next = [...all]
        let k = 0
        for (let i = 0; i < 6 && k < loaded.length; i++) {
          if (startAt !== undefined ? i >= startAt : next[i] === null) next[i] = loaded[k++]!
        }
        return next
      })
    } catch {
      setError('One of the files could not be opened as a picture. Please try a JPG or PNG photo.')
    } finally {
      setBusy(false)
    }
  }

  const readCube = () => {
    photos.forEach((p, i) => {
      if (!p) return
      setFace(i, {
        rgbs: p.rgbs ?? sampleFace(p.pixels, p.box).stickers.map((s) => s.rgb),
        thumbnail: thumbnail(p),
      })
    })
    finish('upload')
    navigate('/check')
  }

  const filled = photos.filter(Boolean).length

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Upload photos or a video</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Take one photo of each side, straight on, all in the same place and light. Any order and
            any way up is fine: the app works out which side is which. Or record one short video
            showing the 6 sides, holding each still for a second. We find the cube for you; drag the
            box or change its size if it's off. Nothing leaves this computer.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={videoRef}
            type="file"
            accept="video/*"
            className="sr-only"
            aria-label="Choose a video"
            onChange={(e) => {
              void addVideo(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button
            variant="outline"
            onClick={() => videoRef.current?.click()}
            disabled={busy || !!video}
          >
            <Film className="size-4" aria-hidden />
            From a video
          </Button>
          <input
            ref={multiRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              void addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button onClick={() => multiRef.current?.click()} disabled={busy}>
            <Upload className="size-4" aria-hidden />
            {busy ? 'Opening…' : 'Add photos'}
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {error}
        </p>
      )}

      {video && (
        <div className="bg-card space-y-2 rounded-xl border p-4" role="status">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Reading the video… found {video.found} of 6 sides</span>
            <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              <X className="size-4" aria-hidden />
              Stop
            </Button>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-[width]"
              style={{ width: `${video.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {videoResult && !video && (
        <p role="status" className="rounded-lg border bg-sky-500/10 p-3 text-sm">
          {videoResult}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SCAN_ORDER.map((step, i) => (
          <PhotoSlot
            key={step.front}
            index={i}
            photo={photos[i] ?? null}
            onFile={(files) => void addFiles(files, i)}
            onChange={(p) => setPhoto(i, p)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" onClick={readCube} disabled={filled < 6}>
          Read my cube
        </Button>
        <span className="text-muted-foreground text-sm">{filled} of 6 photos added</span>
        <span className="text-muted-foreground text-sm">
          Or{' '}
          <Link to="/scan" className="underline">
            scan with your webcam
          </Link>
          .
        </span>
      </div>
    </div>
  )
}

function PhotoSlot({
  index,
  photo,
  onFile,
  onChange,
}: {
  index: number
  photo: Photo | null
  onFile: (files: FileList | null) => void
  onChange: (p: Photo | null) => void
}) {
  const step = SCAN_ORDER[index]!
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; box: Box } | null>(null)

  const guesses = photo
    ? sampleFace(photo.pixels, photo.box).stickers.map((s) => nearestNominal(s.lab))
    : []
  const wrongSide = photo && guesses[4] !== step.front

  const clampBox = (b: Box): Box => {
    if (!photo) return b
    const { width, height } = photo.pixels
    const size = Math.max(20, Math.min(b.size, width, height))
    return {
      size,
      x: Math.max(0, Math.min(width - size, b.x)),
      y: Math.max(0, Math.min(height - size, b.y)),
    }
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!photo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, box: photo.box }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!photo || !drag.current || !imgRef.current) return
    const k = photo.pixels.width / imgRef.current.clientWidth
    const d = drag.current
    onChange({
      ...photo,
      box: clampBox({
        ...d.box,
        x: d.box.x + (e.clientX - d.x) * k,
        y: d.box.y + (e.clientY - d.y) * k,
      }),
    })
  }

  return (
    <section className="bg-card space-y-3 rounded-xl border p-4" aria-label={`${step.front} side`}>
      <div className="flex items-center gap-2 text-sm">
        <span
          className="size-5 rounded-sm border border-black/20"
          style={{ background: STICKER_FILL[step.front] }}
          aria-hidden
        />
        <span className="font-medium">{capitalize(step.front)} side</span>
        <span className="text-muted-foreground">· {step.top} at the top</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files)
          e.target.value = ''
        }}
      />

      {photo ? (
        <>
          <div ref={imgRef} className="relative overflow-hidden rounded-lg bg-black select-none">
            <img
              src={photo.url}
              alt={`Photo of the ${step.front} side`}
              className="block w-full"
              draggable={false}
            />
            <div
              role="slider"
              aria-label="Cube face box: drag to move"
              aria-valuenow={Math.round(photo.box.x)}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              className={cn(
                'absolute grid cursor-move touch-none grid-cols-3 grid-rows-3 border-[3px]',
                'border-green-400',
              )}
              style={{
                left: `${(photo.box.x / photo.pixels.width) * 100}%`,
                top: `${(photo.box.y / photo.pixels.height) * 100}%`,
                width: `${(photo.box.size / photo.pixels.width) * 100}%`,
                height: `${(photo.box.size / photo.pixels.height) * 100}%`,
              }}
            >
              {guesses.map((g, i) => (
                <div key={i} className="flex items-end justify-end border border-white/30 p-0.5">
                  <span
                    className="size-3 rounded-sm border border-black/40"
                    style={{ background: STICKER_FILL[g] }}
                  />
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            Box size
            <input
              type="range"
              min={20}
              max={100}
              value={Math.round(
                (photo.box.size / Math.min(photo.pixels.width, photo.pixels.height)) * 100,
              )}
              onChange={(e) => {
                const size =
                  (Number(e.target.value) / 100) * Math.min(photo.pixels.width, photo.pixels.height)
                const cx = photo.box.x + photo.box.size / 2
                const cy = photo.box.y + photo.box.size / 2
                onChange({ ...photo, box: clampBox({ size, x: cx - size / 2, y: cy - size / 2 }) })
              }}
              className="flex-1"
            />
          </label>

          <p className="text-muted-foreground text-xs">
            {photo.autoFound
              ? 'Cube found. Move the box if it is not lined up with the stickers.'
              : "We couldn't find the cube. Drag the box over the 9 stickers."}
            {wrongSide && ` (Looks like the ${guesses[4]} side; that's fine, any slot works.)`}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onChange(rotatePhoto(photo))}>
              <RotateCw className="size-4" aria-hidden />
              Rotate
            </Button>
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
              aria-label={`Remove the ${step.front} photo`}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            onFile(e.dataTransfer.files)
          }}
          className="text-muted-foreground hover:bg-muted flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed text-sm"
        >
          <ImagePlus className="size-8" aria-hidden />
          Choose or drop a photo
        </button>
      )}
    </section>
  )
}
