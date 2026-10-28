import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'
import { describeMove, describeRotation } from '@/modules/solution'
import type { Face, Rotation } from '@/modules/cube'

const FACES: { face: Face; name: string }[] = [
  { face: 'F', name: 'Front (facing you)' },
  { face: 'B', name: 'Back' },
  { face: 'U', name: 'Up (top)' },
  { face: 'D', name: 'Down (bottom)' },
  { face: 'R', name: 'Right' },
  { face: 'L', name: 'Left' },
]

const ROTATIONS: Rotation[] = ['y', "y'", 'y2', 'z2']

/** Simple drawing of a cube with the three visible faces labelled. */
function CubeDiagram() {
  return (
    <svg
      viewBox="0 0 200 190"
      className="h-auto w-48"
      role="img"
      aria-label="Cube with U on top, F in front and R on the right"
    >
      <polygon
        points="100,10 180,50 100,90 20,50"
        fill="var(--sticker-white)"
        stroke="#111"
        strokeWidth="3"
      />
      <polygon
        points="20,50 100,90 100,180 20,140"
        fill="var(--sticker-green)"
        stroke="#111"
        strokeWidth="3"
      />
      <polygon
        points="100,90 180,50 180,140 100,180"
        fill="var(--sticker-red)"
        stroke="#111"
        strokeWidth="3"
      />
      <text x="100" y="58" textAnchor="middle" fontSize="26" fontWeight="700" fill="#111">
        U
      </text>
      <text x="60" y="125" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff">
        F
      </text>
      <text x="140" y="125" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff">
        R
      </text>
    </svg>
  )
}

export function NotationPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Learn the move notation</h1>
        <p className="text-muted-foreground">
          Every solution is written with a few letters. Hold the cube so one face points at you;
          each letter names a face of the cube <em>as you are holding it</em>.
        </p>
      </header>

      <section className="bg-card flex flex-col items-center gap-6 rounded-xl border p-5 sm:flex-row">
        <CubeDiagram />
        <ul className="space-y-1 text-sm">
          <li>
            <strong>U</strong> is the top, <strong>D</strong> the bottom.
          </li>
          <li>
            <strong>F</strong> faces you, <strong>B</strong> is at the back.
          </li>
          <li>
            <strong>R</strong> is on your right, <strong>L</strong> on your left.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">The six face turns</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-3 py-2">Letter</th>
                <th className="px-3 py-2">Face</th>
                <th className="px-3 py-2">Letter alone (clockwise)</th>
                <th className="px-3 py-2">With ′ (counter-clockwise)</th>
              </tr>
            </thead>
            <tbody>
              {FACES.map(({ face, name }) => (
                <tr key={face} className="border-t">
                  <td className="px-3 py-2 font-mono text-lg font-bold">{face}</td>
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2">{describeMove({ face, turns: 1 })}</td>
                  <td className="px-3 py-2">{describeMove({ face, turns: 3 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
          <li>
            <strong className="text-foreground">Clockwise</strong> means clockwise as if you were
            looking straight at that face.
          </li>
          <li>
            <code className="text-foreground font-mono">R</code> = a quarter turn (90°) clockwise.
          </li>
          <li>
            <code className="text-foreground font-mono">R'</code> (say “R prime”) = a quarter turn
            counter-clockwise.
          </li>
          <li>
            <code className="text-foreground font-mono">R2</code> = a half turn (180°); either
            direction works.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Turning the whole cube</h2>
        <p className="text-muted-foreground text-sm">
          The beginner guide sometimes asks you to turn the whole cube in your hands. Nothing on the
          cube changes; you just hold it differently. The app shows these steps in amber.
        </p>
        <ul className="space-y-2 text-sm">
          {ROTATIONS.map((r) => (
            <li key={r} className="flex gap-3">
              <code className="w-8 shrink-0 font-mono font-bold">{r}</code>
              <span>{describeRotation(r)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/manual" className={buttonVariants()}>
          Enter my cube
        </Link>
        <Link to="/" className={buttonVariants({ variant: 'outline' })}>
          Back to home
        </Link>
      </div>
    </div>
  )
}
