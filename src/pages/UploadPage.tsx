import { ImagePlus, RotateCw, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { capitalize, STICKER_FILL } from '@/components/cube/colors'
import { Button } from '@/components/ui/button'
import { SCAN_ORDER } from '@/modules/cube'
import { centeredBox, findFaceBox, nearestNominal, sampleFace, type Box } from '@/modules/vision'
import { cn } from '@/lib/utils'
import { useScanStore } from '@/store/scanStore'

const MAX_SIDE = 800

type Photo = { pixels: ImageData; url: string; box: Box; autoFound: boolean }

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
  const multiRef = useRef<HTMLInputElement>(null)

  useEffect(() => reset(), [reset])

  const setPhoto = (i: number, p: Photo | null) =>
    setPhotos((all) => all.map((x, k) => (k === i ? p : x)))

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
        rgbs: sampleFace(p.pixels, p.box).stickers.map((s) => s.rgb),
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
          <h1 className="text-2xl font-semibold">Upload photos</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Take one photo of each side, straight on, with the side shown on top at the top of the
            picture. Take all 6 in the same place and light. We find the cube in each photo; drag
            the box or change its size if it's off. Photos stay on this computer.
          </p>
        </div>
        <div className="flex gap-2">
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
                wrongSide ? 'border-amber-400' : 'border-green-400',
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

          <p className={cn('text-xs', wrongSide ? 'text-amber-500' : 'text-muted-foreground')}>
            {wrongSide
              ? `The middle looks ${guesses[4]}, but this should be the ${step.front} side. Check the photo or move the box.`
              : photo.autoFound
                ? 'Cube found. Move the box if it is not lined up with the stickers.'
                : "We couldn't find the cube. Drag the box over the 9 stickers."}
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
