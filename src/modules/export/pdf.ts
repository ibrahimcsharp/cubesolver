/**
 * Printable step-by-step booklet (PLAN.md section 9.1), made in the browser.
 */
import { jsPDF } from 'jspdf'
import { stepAnimation } from '@/components/cube3d/animation'
import { STICKER_HEX } from '@/components/cube/colors'
import { FACES, type Face, type Move, type Rotation, type StickerColor } from '@/modules/cube'
import { describeMove, describeRotation, type Solution } from '@/modules/solution'
import { CubeRenderer } from './cubeRenderer'
import { exportSteps, holdText } from './timeline'

export type PdfOptions = {
  pageSize: 'a4' | 'letter'
  /** Gray pictures and color letters on the map, for black & white printers. */
  blackAndWhite: boolean
  onProgress?: (share: number) => void
  signal?: AbortSignal
}

const MARGIN = 15
const LETTER: Record<StickerColor, string> = {
  white: 'W',
  yellow: 'Y',
  green: 'G',
  blue: 'B',
  red: 'R',
  orange: 'O',
}

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]
const gray = ([r, g, b]: [number, number, number]): [number, number, number] => {
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  return [v, v, v]
}

export class PdfCancelled extends Error {}

export async function makeSolutionPdf(solution: Solution, opts: PdfOptions): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: opts.pageSize })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const contentW = PW - 2 * MARGIN
  const { start, items } = exportSteps(solution)
  const colorOf = solution.colorOf
  const bw = opts.blackAndWhite

  const renderer = new CubeRenderer(320, '#ffffff')
  const grayCanvas = document.createElement('canvas')
  grayCanvas.width = grayCanvas.height = 320
  /** Picture of the cube (as the user sees it), optionally with the next turn's arrow. */
  const picture = (view: string, arrowFor: (typeof items)[number]['step'] | null): string => {
    renderer.setStickers(view, colorOf)
    renderer.setTurn(null, 0)
    renderer.setArrow(arrowFor ? stepAnimation(arrowFor) : null)
    const canvas = renderer.render()
    if (!bw) return canvas.toDataURL('image/jpeg', 0.85)
    const g = grayCanvas.getContext('2d')!
    g.filter = 'grayscale(1)'
    g.drawImage(canvas, 0, 0)
    return grayCanvas.toDataURL('image/jpeg', 0.85)
  }

  const fill = (hex: string) => doc.setFillColor(...(bw ? gray(hexToRgb(hex)) : hexToRgb(hex)))
  const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color = 20) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(color)
  }
  const lines = (text: string, width: number): string[] => doc.splitTextToSize(text, width)

  /** Flat map of all 54 stickers. */
  const net = (view: string, x: number, y: number, cell: number) => {
    const pos: Record<Face, [number, number]> = {
      U: [1, 0],
      L: [0, 1],
      F: [1, 1],
      R: [2, 1],
      B: [3, 1],
      D: [1, 2],
    }
    const faceSize = cell * 3 + 1.5
    FACES.forEach((face, f) => {
      const [col, row] = pos[face]
      const fx = x + col * faceSize
      const fy = y + row * faceSize
      for (let i = 0; i < 9; i++) {
        const color = colorOf[view[f * 9 + i] as Face]
        fill(STICKER_HEX[color])
        doc.setDrawColor(30)
        doc.setLineWidth(0.3)
        const sx = fx + (i % 3) * cell
        const sy = fy + Math.floor(i / 3) * cell
        doc.rect(sx, sy, cell, cell, 'FD')
        if (bw) {
          font(cell * 1.6, 'bold', color === 'white' || color === 'yellow' ? 40 : 255)
          doc.text(LETTER[color], sx + cell / 2, sy + cell * 0.68, { align: 'center' })
        }
      }
    })
  }

  // ---------- Cover ----------
  font(26, 'bold')
  doc.text("Your Rubik's Cube Solution", MARGIN, MARGIN + 10)
  font(12, 'normal', 90)
  const styleName = solution.style === 'beginner' ? 'Beginner method (7 stages)' : 'Fast solution'
  doc.text(
    `${styleName} · ${solution.moveCount} moves · ${new Date().toLocaleDateString()}`,
    MARGIN,
    MARGIN + 18,
  )
  const coverImg = 95
  doc.addImage(picture(start, null), 'JPEG', MARGIN, MARGIN + 26, coverImg, coverImg)
  font(12, 'bold')
  doc.text('Start like this', MARGIN + coverImg + 6, MARGIN + 40)
  font(11)
  doc.text(
    lines(
      `Hold your cube with ${holdText(solution.startOrientation, colorOf)}. Check that it matches the picture and the map below before you begin.`,
      contentW - coverImg - 6,
    ),
    MARGIN + coverImg + 6,
    MARGIN + 47,
  )
  font(12, 'bold')
  doc.text('All 54 stickers of your scanned cube', MARGIN, MARGIN + coverImg + 40)
  net(start, MARGIN, MARGIN + coverImg + 45, 6)
  font(9, 'italic', 110)
  doc.text(
    lines(
      'Map: the top, left, front, right, back and bottom sides, with the cube held as described above. Each side is seen from outside the cube.',
      contentW,
    ),
    MARGIN,
    MARGIN + coverImg + 45 + 3 * (18 + 1.5) + 6,
  )

  // ---------- How to read ----------
  doc.addPage()
  font(18, 'bold')
  doc.text('How to read this guide', MARGIN, MARGIN + 8)
  font(11)
  let y = MARGIN + 17
  for (const l of lines(
    'Each step shows your cube before the move, with a blue arrow showing which way to turn. Letters name the sides of the cube as you are holding it. Amber arrows mean: turn the whole cube in your hands.',
    contentW,
  )) {
    doc.text(l, MARGIN, y)
    y += 5.5
  }
  y += 4
  const cols = [MARGIN, MARGIN + 16, MARGIN + 46, MARGIN + 113]
  font(10, 'bold')
  ;['Letter', 'Side', 'Letter alone (clockwise)', "With ' (counter-clockwise)"].forEach((h, i) =>
    doc.text(h, cols[i]!, y),
  )
  y += 3
  doc.setDrawColor(180)
  doc.line(MARGIN, y, PW - MARGIN, y)
  y += 6
  const sideNames: Record<Face, string> = {
    F: 'Front',
    B: 'Back',
    U: 'Up (top)',
    D: 'Down',
    R: 'Right',
    L: 'Left',
  }
  for (const face of ['F', 'B', 'U', 'D', 'R', 'L'] as Face[]) {
    font(13, 'bold')
    doc.text(face, cols[0]!, y)
    font(9.5)
    doc.text(sideNames[face], cols[1]!, y)
    const cw = lines(describeMove({ face, turns: 1 }), 62)
    const ccw = lines(describeMove({ face, turns: 3 }), 68)
    doc.text(cw, cols[2]!, y)
    doc.text(ccw, cols[3]!, y)
    y += Math.max(cw.length, ccw.length) * 4.5 + 3
  }
  y += 3
  font(10)
  for (const l of [
    'R2 (with a 2) means a half turn: turn that side twice. R\' is said "R prime".',
    'Clockwise means clockwise as if you were looking straight at that side.',
  ]) {
    doc.text(lines(l, contentW), MARGIN, y)
    y += 6
  }
  y += 4
  font(12, 'bold')
  doc.text('Turning the whole cube', MARGIN, y)
  y += 7
  font(10)
  for (const r of ['y', "y'", 'y2', 'z2'] as Rotation[]) {
    font(11, 'bold')
    doc.text(r, MARGIN, y)
    font(10)
    doc.text(describeRotation(r), MARGIN + 12, y)
    y += 6.5
  }

  // ---------- Steps ----------
  const COLS = 5
  const gap = 4
  const cellW = (contentW - gap * (COLS - 1)) / COLS
  const imgSize = cellW - 4
  const cellH = imgSize + 20
  let col = 0
  let rowY = PH // forces a new page for the first stage
  let lastGroup: unknown = null

  const newPage = () => {
    doc.addPage()
    rowY = MARGIN
    col = 0
  }
  const ensure = (h: number) => {
    if (rowY + h > PH - MARGIN - 8) newPage()
  }
  const endRow = () => {
    if (col > 0) {
      rowY += cellH + gap
      col = 0
    }
  }

  for (const [k, item] of items.entries()) {
    if (opts.signal?.aborted) throw new PdfCancelled()
    if (k % 8 === 0) {
      opts.onProgress?.(k / items.length)
      await new Promise((r) => setTimeout(r, 0)) // let the page update
    }

    if (item.stageStart) {
      endRow()
      if (solution.style === 'beginner' || k === 0) {
        // Keep going on the same page if the title and a row of moves fit.
        const goal = lines(item.stage.goal, contentW)
        const headerH = 15 + goal.length * 4.5
        if (k === 0) newPage()
        else {
          rowY += 6
          ensure(headerH + 12 + cellH)
        }
        font(16, 'bold')
        doc.text(item.stage.title, MARGIN, rowY + 6)
        font(10, 'normal', 80)
        doc.text(goal, MARGIN, rowY + 13)
        rowY += headerH
      }
    }
    if (item.group !== lastGroup) {
      endRow()
      lastGroup = item.group
      const expl = lines(item.group.explanation, contentW)
      ensure(expl.length * 4.2 + 3 + cellH)
      font(9.5, 'italic', 60)
      doc.text(expl, MARGIN, rowY + 4)
      rowY += expl.length * 4.2 + 3
    }
    if (col === 0) ensure(cellH)

    const x = MARGIN + col * (cellW + gap)
    doc.setDrawColor(215)
    doc.setLineWidth(0.25)
    doc.roundedRect(x, rowY, cellW, cellH, 2, 2, 'S')
    doc.addImage(picture(item.before, item.step), 'JPEG', x + 2, rowY + 2, imgSize, imgSize)
    const isMove = item.step.kind === 'move'
    font(8, 'normal', 120)
    doc.text(isMove ? `#${item.moveNumber}` : 'Turn cube', x + 2.5, rowY + imgSize + 6)
    font(13, 'bold', isMove ? 20 : 150)
    doc.text(
      isMove ? item.step.notation : `(${item.step.notation})`,
      x + cellW - 2.5,
      rowY + imgSize + 7,
      {
        align: 'right',
      },
    )
    font(7)
    const txt = isMove
      ? describeMove((item.step as { move: Move }).move)
      : describeRotation((item.step as { rotation: Rotation }).rotation)
    doc.text(lines(txt, cellW - 4).slice(0, 3), x + 2, rowY + imgSize + 11.5)

    col++
    if (col === COLS) endRow()
  }

  // ---------- Solved ----------
  doc.addPage()
  font(30, 'bold', 20)
  doc.text('Solved!', PW / 2, MARGIN + 25, { align: 'center' })
  const finalView = items.at(-1)?.after ?? start
  doc.addImage(picture(finalView, null), 'JPEG', (PW - 100) / 2, MARGIN + 35, 100, 100)
  font(11, 'normal', 80)
  doc.text(
    lines(
      'If you got lost on the way, scan your cube again in the app to get a new solution from where it is now.',
      contentW,
    ),
    PW / 2,
    MARGIN + 150,
    { align: 'center' },
  )

  // Page numbers.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    font(8, 'normal', 140)
    doc.text(`CubeSolver · page ${p} of ${pages}`, PW / 2, PH - 7, { align: 'center' })
  }

  renderer.dispose()
  opts.onProgress?.(1)
  return doc.output('blob')
}
