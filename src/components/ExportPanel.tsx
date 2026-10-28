/** "Download" box on the solution screen: PDF booklet and video. */
import { Download, FileText, Film, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Solution } from '@/modules/solution'
import { SPEEDS, useSettingsStore } from '@/store/settingsStore'

type Job = { kind: 'pdf' | 'video'; progress: number }
type Ready = { url: string; name: string; size: number; kind: 'pdf' | 'video' }

function saveFile(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const usesLetter = () => /^en-(US|CA)|^es-(MX|US)/.test(navigator.language)

export function ExportPanel({ solution }: { solution: Solution }) {
  const speed = useSettingsStore((s) => s.speed)
  const [pageSize, setPageSize] = useState<'a4' | 'letter'>(() => (usesLetter() ? 'letter' : 'a4'))
  const [blackAndWhite, setBlackAndWhite] = useState(false)
  const [height, setHeight] = useState<720 | 1080>(720)
  const [pauseMs, setPauseMs] = useState(700)
  const [job, setJob] = useState<Job | null>(null)
  const [ready, setReady] = useState<Ready | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Free the file's memory when it is replaced or the page closes.
  useEffect(
    () => () => {
      if (ready) URL.revokeObjectURL(ready.url)
    },
    [ready],
  )
  useEffect(() => () => abortRef.current?.abort(), [])

  const styleName = solution.style === 'beginner' ? 'beginner' : 'fast'
  const quarterMs = SPEEDS[speed]
  const videoMinutes =
    (solution.moveCount * (quarterMs + pauseMs + 500)) / 60000 +
    (solution.style === 'beginner' ? 0.4 : 0.15)

  const run = async (kind: 'pdf' | 'video') => {
    setError(null)
    setReady(null)
    const abort = new AbortController()
    abortRef.current = abort
    setJob({ kind, progress: 0 })
    const onProgress = (progress: number) => setJob({ kind, progress })
    try {
      if (kind === 'pdf') {
        const { makeSolutionPdf } = await import('@/modules/export/pdf')
        const blob = await makeSolutionPdf(solution, {
          pageSize,
          blackAndWhite,
          onProgress,
          signal: abort.signal,
        })
        const r = {
          url: URL.createObjectURL(blob),
          name: `cube-solution-${styleName}.pdf`,
          size: blob.size,
          kind,
        }
        setReady(r)
        saveFile(r.url, r.name)
      } else {
        const { makeSolutionVideo } = await import('@/modules/export/video')
        const v = await makeSolutionVideo(solution, {
          height,
          quarterMs,
          pauseMs,
          onProgress,
          signal: abort.signal,
        })
        const r = {
          url: URL.createObjectURL(v.blob),
          name: `cube-solution-${styleName}.${v.extension}`,
          size: v.blob.size,
          kind,
        }
        setReady(r)
        saveFile(r.url, r.name)
      }
    } catch (e) {
      if (!abort.signal.aborted)
        setError(
          `Sorry, the ${kind === 'pdf' ? 'PDF' : 'video'} could not be made${e instanceof Error ? ` (${e.message})` : ''}.`,
        )
    } finally {
      setJob(null)
    }
  }

  const select = 'bg-card text-foreground rounded-md border px-2 py-1'

  return (
    <section aria-labelledby="download-heading" className="bg-card space-y-4 rounded-xl border p-5">
      <h2 id="download-heading" className="flex items-center gap-2 font-semibold">
        <Download className="size-4" aria-hidden />
        Download this solution
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <p className="flex items-center gap-2 font-medium">
            <FileText className="text-primary size-4" aria-hidden />
            PDF booklet
          </p>
          <p className="text-muted-foreground text-sm">
            A printable guide: your cube, how to read the moves, and a picture for every step.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Paper
              <select
                className={select}
                value={pageSize}
                onChange={(e) => setPageSize(e.target.value as 'a4' | 'letter')}
              >
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={blackAndWhite}
                onChange={(e) => setBlackAndWhite(e.target.checked)}
              />
              Black & white printer
            </label>
          </div>
          <Button onClick={() => run('pdf')} disabled={!!job}>
            <FileText className="size-4" aria-hidden />
            Download PDF
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <p className="flex items-center gap-2 font-medium">
            <Film className="text-primary size-4" aria-hidden />
            Video
          </p>
          <p className="text-muted-foreground text-sm">
            Every move animated on your cube, with captions. About{' '}
            {Math.max(1, Math.round(videoMinutes))} min long at the “{speed}” speed.
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Size
              <select
                className={select}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) as 720 | 1080)}
              >
                <option value={720}>720p</option>
                <option value={1080}>1080p</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Pause after each move
              <select
                className={select}
                value={pauseMs}
                onChange={(e) => setPauseMs(Number(e.target.value))}
              >
                <option value={300}>Short</option>
                <option value={700}>Normal</option>
                <option value={1500}>Long</option>
              </select>
            </label>
          </div>
          <Button onClick={() => run('video')} disabled={!!job}>
            <Film className="size-4" aria-hidden />
            Make video
          </Button>
        </div>
      </div>

      {job && (
        <div role="status" className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              Making your {job.kind === 'pdf' ? 'PDF' : 'video'}… {Math.round(job.progress * 100)}%
            </span>
            <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              <X className="size-4" aria-hidden />
              Cancel
            </Button>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full transition-[width]"
              style={{ width: `${job.progress * 100}%` }}
            />
          </div>
        </div>
      )}
      {ready && !job && (
        <p role="status" className="text-sm">
          Done: <strong>{ready.name}</strong> ({mb(ready.size)}).{' '}
          <a href={ready.url} download={ready.name} className="text-primary underline">
            Download again
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      <p className="text-muted-foreground text-xs">Made on this computer; nothing is uploaded.</p>
    </section>
  )
}
