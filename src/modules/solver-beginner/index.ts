/**
 * Beginner (Learn) mode: the 7-stage layer-by-layer method from PLAN.md
 * section 7.3. Each stage uses the same standard patterns a person would learn,
 * and every group of moves says what it is doing and why.
 *
 * Stages 1-2 are done with the first-layer color (normally white) on top.
 * Then the cube is turned upside down and stages 3-7 are done with the
 * last-layer color (normally yellow) on top.
 */
import {
  applyMove,
  CORNER_COLORS,
  CORNER_FACELETS,
  EDGE_COLORS,
  EDGE_FACELETS,
  faceOfFacelet,
  isSolved,
  rotate,
  toFacelets,
  toFixedMove,
  type CubieCube,
  type Face,
  type Move,
  type Orientation,
  type Rotation,
  type Turns,
  type ValidCube,
  parseMoves,
} from '@/modules/cube'
import { SolutionBuilder, type Solution } from '@/modules/solution'
import { edgesDistance, solveEdges } from './crossTable'

export const ALGORITHMS = {
  cornerInsert: "R' D' R D",
  middleRight: "U R U' R' U' F' U F",
  middleLeft: "U' L' U L U F U' F'",
  lastCross: "F R U R' U' F'",
  lastEdges: "R U R' U R U2 R'",
  lastCornersPosition: "U R U' L' U R' U' L",
  lastCornersTwist: "R' D' R D",
} as const

const SIDES: readonly Face[] = ['F', 'R', 'B', 'L']
const ROTATION_CHOICES: readonly (Rotation | null)[] = [null, 'y', "y'", 'y2']
const TURN_SUFFIX: Record<Turns, string> = { 1: '', 2: '2', 3: "'" }
const MAX_LOOPS = 12

// ---------- small helpers ----------

const sameFaces = (a: readonly Face[], b: readonly Face[]) =>
  a.length === b.length && a.every((f) => b.includes(f))

/** Fixed corner position whose three faces are the given fixed faces. */
const cornerAt = (faces: readonly Face[]) => CORNER_COLORS.findIndex((c) => sameFaces(c, faces))
const edgeAt = (faces: readonly Face[]) => EDGE_COLORS.findIndex((c) => sameFaces(c, faces))

/** Fixed position of the corner the user sees at user faces (e.g. U, R, F). */
const userCorner = (o: Orientation, ...user: Face[]) => cornerAt(user.map((f) => o[f]))
const userEdge = (o: Orientation, ...user: Face[]) => edgeAt(user.map((f) => o[f]))

const cornerSolved = (c: CubieCube, i: number) => c.cp[i] === i && c.co[i] === 0
const edgeSolved = (c: CubieCube, i: number) => c.ep[i] === i && c.eo[i] === 0

/** Applies user-side moves to a copy, without recording them. */
function simulate(cube: CubieCube, o: Orientation, moves: readonly Move[]): CubieCube {
  let c = cube
  for (const m of moves) c = applyMove(c, toFixedMove(o, m))
  return c
}

function layerTurn(face: Face, turns: number): string {
  const t = (((turns % 4) + 4) % 4) as 0 | Turns
  return t === 0 ? '' : face + TURN_SUFFIX[t]
}

/** Color of the sticker at the given facelet index (as a face letter). */
function stickerOnFace(cube: CubieCube, facelets: readonly number[], face: Face): Face {
  const f = toFacelets(cube)
  const idx = facelets.find((i) => faceOfFacelet(i) === face)
  if (idx === undefined) throw new Error('Sticker not on that face')
  return f[idx] as Face
}

class BeginnerSolver {
  private readonly b: SolutionBuilder

  constructor(start: ValidCube) {
    this.b = new SolutionBuilder(start.cube, 'beginner', start.colorOf)
  }

  private get cube() {
    return this.b.cube
  }
  private get o() {
    return this.b.orientation
  }
  private color(face: Face) {
    return this.b.colorOfFixed(face)
  }
  private edgeName(piece: number) {
    return EDGE_COLORS[piece]!.map((f) => this.color(f)).join('-')
  }
  private cornerName(piece: number) {
    return CORNER_COLORS[piece]!.map((f) => this.color(f)).join('-')
  }

  /** Turns the whole cube (if needed) until the check passes. */
  private rotateUntil(check: (o: Orientation) => boolean, explanation: string) {
    for (const r of ROTATION_CHOICES) {
      const next = r ? rotate(this.o, r) : this.o
      if (check(next)) {
        if (r) this.b.rotate(r, explanation)
        return
      }
    }
    throw new Error('No whole-cube turn satisfies the check')
  }

  /** Smallest number of user-U (or D) turns that makes the check pass. */
  private layerTurnsUntil(face: 'U' | 'D', check: (c: CubieCube) => boolean): number | null {
    for (let k = 0; k < 4; k++) {
      const moves = k === 0 ? [] : parseMoves(layerTurn(face, k))
      if (check(simulate(this.cube, this.o, moves))) return k
    }
    return null
  }

  private repeatUntil(alg: string, check: (c: CubieCube) => boolean, max: number): number {
    const moves = parseMoves(alg)
    let c = this.cube
    for (let n = 0; n <= max; n++) {
      if (check(c)) return n
      c = simulate(c, this.o, moves)
    }
    throw new Error(`"${alg}" did not finish the job in ${max} repeats`)
  }

  // ---------- Stage 1: cross ----------

  private cross() {
    const top = this.color('U')
    this.b.startStage(
      'cross',
      `Stage 1: ${cap(top)} cross`,
      `Hold the cube with ${top} on top and ${this.color('F')} facing you. Make a ${top} plus sign on top, with each edge's side color matching the center beside it.`,
    )
    const crossEdges = [0, 1, 2, 3] // UR UF UL UB
    const placed: number[] = []
    while (placed.length < 4) {
      const remaining = crossEdges.filter((e) => !placed.includes(e))
      // Place whichever edge needs the fewest moves next.
      const next = remaining
        .map((e) => ({ e, d: edgesDistance(this.cube, [...placed, e]) }))
        .sort((x, y) => x.d - y.d)[0]!
      placed.push(next.e)
      const side = EDGE_COLORS[next.e]![1]
      this.b.moves(
        solveEdges(this.cube, placed),
        `Bring the ${this.edgeName(next.e)} edge to the top, with its ${this.color(side)} side above the ${this.color(side)} center.`,
      )
    }
  }

  // ---------- Stage 2: first-layer corners ----------

  /** Moves needed to insert bottom-layer corner j with R' D' R D (for picking the order). */
  private cornerInsertCost(j: number): number {
    const r = ROTATION_CHOICES.find(
      (x) => userCorner(x ? rotate(this.o, x) : this.o, 'U', 'R', 'F') === j,
    )
    const o = r ? rotate(this.o, r) : this.o
    const below = userCorner(o, 'D', 'F', 'R')
    const insert = parseMoves(ALGORITHMS.cornerInsert)
    for (let k = 0; k < 4; k++) {
      let c = simulate(this.cube, o, k === 0 ? [] : parseMoves(layerTurn('D', k)))
      if (c.cp[below] !== j) continue
      for (let reps = 0; reps <= 5; reps++) {
        if (cornerSolved(c, j)) return (k === 0 ? 0 : 1) + reps * insert.length + (r ? 1 : 0)
        c = simulate(c, o, insert)
      }
    }
    return Infinity
  }

  private firstCorners() {
    const top = this.color('U')
    this.b.startStage(
      'first-corners',
      `Stage 2: ${cap(top)} corners`,
      `Finish the whole ${top} face and the first layer. Keep ${top} on top.`,
    )
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const unsolved = [0, 1, 2, 3].filter((j) => !cornerSolved(this.cube, j))
      if (unsolved.length === 0) return
      // Of the corners already in the bottom layer, do the quickest one first.
      const inBottom = unsolved
        .filter((j) => this.cube.cp.indexOf(j) >= 4)
        .map((j) => ({ j, cost: this.cornerInsertCost(j) }))
        .sort((a, b) => a.cost - b.cost)[0]?.j

      if (inBottom === undefined) {
        // Stuck in the top layer: pop it down first.
        const j = unsolved[0]!
        const pos = this.cube.cp.indexOf(j)
        this.rotateUntil(
          (o) => userCorner(o, 'U', 'R', 'F') === pos,
          `Turn the whole cube so the ${this.cornerName(j)} corner is at the front-right of the top layer.`,
        )
        this.b.moves(
          ALGORITHMS.cornerInsert,
          `This corner is in the top layer but in the wrong spot or twisted. Do ${ALGORITHMS.cornerInsert} once to move it down to the bottom layer.`,
          ALGORITHMS.cornerInsert,
        )
        continue
      }

      const j = inBottom
      const name = this.cornerName(j)
      this.rotateUntil(
        (o) => userCorner(o, 'U', 'R', 'F') === j,
        `Turn the whole cube so the spot where the ${name} corner belongs is at the front-right of the top layer.`,
      )
      const below = userCorner(this.o, 'D', 'F', 'R')
      const k = this.layerTurnsUntil('D', (c) => c.cp[below] === j)!
      this.b.moves(
        layerTurn('D', k),
        `Turn the bottom layer to bring the ${name} corner directly under its spot.`,
      )
      const reps = this.repeatUntil(ALGORITHMS.cornerInsert, (c) => cornerSolved(c, j), 5)
      this.b.moves(
        Array.from({ length: reps }, () => ALGORITHMS.cornerInsert).join(' '),
        `Repeat ${ALGORITHMS.cornerInsert} ${times(reps)} until the ${name} corner is in place with ${top} on top.`,
        ALGORITHMS.cornerInsert,
      )
    }
    throw new Error('First-layer corners did not finish')
  }

  // ---------- Turn over ----------

  private flip() {
    this.b.startStage(
      'flip',
      'Turn the cube over',
      `The first layer is done. From now on, ${this.color('D')} is on top.`,
    )
    this.b.rotate(
      'z2',
      `Turn the cube upside down. ${cap(this.color('D'))} is now on top and ${this.color('U')} is on the bottom.`,
    )
  }

  // ---------- Stage 3: middle layer ----------

  private middleLayer() {
    this.b.startStage(
      'middle',
      'Stage 3: Middle layer',
      `Place the 4 edges of the middle layer. These are the edges with no ${this.color(this.o.U)} sticker.`,
    )
    const middle = [8, 9, 10, 11] // FR FL BL BR
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      if (middle.every((e) => edgeSolved(this.cube, e))) return
      const topFace = this.o.U
      const inTop = middle.find((e) => EDGE_COLORS[this.cube.ep.indexOf(e)]!.includes(topFace))

      if (inTop === undefined) {
        // An edge is stuck in the middle layer: kick it out to the top.
        const pos = middle.find((p) => !edgeSolved(this.cube, p))!
        this.rotateUntil(
          (o) => userEdge(o, 'F', 'R') === pos,
          'Turn the whole cube so the wrong middle edge is at the front-right.',
        )
        this.b.moves(
          ALGORITHMS.middleRight,
          `This edge is in the middle layer but in the wrong spot or flipped. Do ${ALGORITHMS.middleRight} to move it up to the top layer.`,
          ALGORITHMS.middleRight,
        )
        continue
      }

      const e = inTop
      const name = this.edgeName(e)
      const pos = this.cube.ep.indexOf(e)
      const [a, bIdx] = EDGE_FACELETS[pos]!
      const topSticker = stickerOnFace(this.cube, [a, bIdx], topFace)
      const sideSticker = EDGE_COLORS[e]!.find((f) => f !== topSticker)!
      this.rotateUntil(
        (o) => o.F === sideSticker,
        `Turn the whole cube so the ${this.color(sideSticker)} center faces you.`,
      )
      const front = userEdge(this.o, 'U', 'F')
      const k = this.layerTurnsUntil('U', (c) => c.ep[front] === e)!
      this.b.moves(
        layerTurn('U', k),
        `Turn the top layer so the ${name} edge sits above the ${this.color(sideSticker)} center.`,
      )
      if (topSticker === this.o.R) {
        this.b.moves(
          ALGORITHMS.middleRight,
          `The ${name} edge's top color (${this.color(topSticker)}) matches the right center, so insert it to the right.`,
          ALGORITHMS.middleRight,
        )
      } else {
        this.b.moves(
          ALGORITHMS.middleLeft,
          `The ${name} edge's top color (${this.color(topSticker)}) matches the left center, so insert it to the left.`,
          ALGORITHMS.middleLeft,
        )
      }
    }
    throw new Error('Middle layer did not finish')
  }

  // ---------- Stage 4: last-layer cross ----------

  /** User sides (F/R/B/L) whose top edge shows the top color on top. */
  private topEdgesUp(c: CubieCube): Face[] {
    return SIDES.filter((s) => {
      const pos = userEdge(this.o, 'U', s)
      return stickerOnFace(c, EDGE_FACELETS[pos]!, this.o.U) === this.o.U
    })
  }

  private lastCross() {
    const top = this.color(this.o.U)
    this.b.startStage(
      'last-cross',
      `Stage 4: ${cap(top)} cross`,
      `Make a ${top} plus sign on top. The side colors don't matter yet.`,
    )
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const up = this.topEdgesUp(this.cube)
      if (up.length === 4) return
      if (up.length === 0) {
        this.b.moves(
          ALGORITHMS.lastCross,
          `Only the center is ${top} (a dot). Do ${ALGORITHMS.lastCross} to start the cross.`,
          ALGORITHMS.lastCross,
        )
        continue
      }
      const isLine = sameFaces(up, ['F', 'B']) || sameFaces(up, ['L', 'R'])
      const target: Face[] = isLine ? ['L', 'R'] : ['B', 'L']
      const k = this.layerTurnsUntil('U', (c) => sameFaces(this.topEdgesUp(c), target))!
      this.b.moves(
        layerTurn('U', k),
        isLine
          ? `Turn the top layer so the ${top} line goes from left to right.`
          : `Turn the top layer so the ${top} L-shape points to the back and the left.`,
      )
      this.b.moves(
        ALGORITHMS.lastCross,
        isLine
          ? `With the line left to right, do ${ALGORITHMS.lastCross} to finish the cross.`
          : `With the L-shape at the back-left, do ${ALGORITHMS.lastCross} to turn it into a line.`,
        ALGORITHMS.lastCross,
      )
    }
    throw new Error('Last-layer cross did not finish')
  }

  // ---------- Stage 5: last-layer edges ----------

  /** User sides whose top edge's side color matches that side's center. */
  private matchedEdges(c: CubieCube, o: Orientation = this.o): Face[] {
    return SIDES.filter((s) => {
      const pos = userEdge(o, 'U', s)
      return stickerOnFace(c, EDGE_FACELETS[pos]!, o[s]) === o[s]
    })
  }

  private lastEdges() {
    const top = this.color(this.o.U)
    this.b.startStage(
      'last-edges',
      `Stage 5: ${cap(top)} edges`,
      `Match the side color of each ${top} edge with the center below it.`,
    )
    const adjacent = (m: Face[]) =>
      m.length === 2 && !sameFaces(m, ['F', 'B']) && !sameFaces(m, ['L', 'R'])

    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const all = this.layerTurnsUntil('U', (c) => this.matchedEdges(c).length === 4)
      if (all !== null) {
        this.b.moves(
          layerTurn('U', all),
          `Turn the top layer so all four ${top} edges match their centers.`,
        )
        return
      }
      const k = this.layerTurnsUntil('U', (c) => adjacent(this.matchedEdges(c)))
      if (k === null) {
        this.b.moves(
          ALGORITHMS.lastEdges,
          `No two side-by-side edges can be matched yet. Do ${ALGORITHMS.lastEdges} once, then look again.`,
          ALGORITHMS.lastEdges,
        )
        continue
      }
      this.b.moves(
        layerTurn('U', k),
        'Turn the top layer until two side-by-side edges match their centers.',
      )
      this.rotateUntil(
        (o) => sameFaces(this.matchedEdges(this.cube, o), ['B', 'R']),
        'Turn the whole cube so the two matching edges are at the back and on the right.',
      )
      this.b.moves(
        ALGORITHMS.lastEdges,
        `With the matching edges at the back and right, do ${ALGORITHMS.lastEdges}.`,
        ALGORITHMS.lastEdges,
      )
    }
    throw new Error('Last-layer edges did not finish')
  }

  // ---------- Stage 6: position last-layer corners ----------

  private topCornerPositions(o: Orientation = this.o): number[] {
    return [0, 1, 2, 3, 4, 5, 6, 7].filter((p) => CORNER_COLORS[p]!.includes(o.U))
  }

  private lastCornersPosition() {
    const top = this.color(this.o.U)
    this.b.startStage(
      'last-corners-position',
      `Stage 6: Position ${top} corners`,
      `Put each ${top} corner in its correct spot, between the three centers that match its colors. It may still be twisted.`,
    )
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const correct = this.topCornerPositions().filter((p) => this.cube.cp[p] === p)
      if (correct.length === 4) return
      if (correct.length === 0) {
        this.b.moves(
          ALGORITHMS.lastCornersPosition,
          `No ${top} corner is in its correct spot yet. Do ${ALGORITHMS.lastCornersPosition} once, then look again.`,
          ALGORITHMS.lastCornersPosition,
        )
        continue
      }
      const keep = correct[0]!
      this.rotateUntil(
        (o) => userCorner(o, 'U', 'R', 'F') === keep,
        `Turn the whole cube so the ${this.cornerName(keep)} corner (already in its spot) is at the front-right.`,
      )
      this.b.moves(
        ALGORITHMS.lastCornersPosition,
        `Keep that corner at the front-right and do ${ALGORITHMS.lastCornersPosition} to move the other three corners around.`,
        ALGORITHMS.lastCornersPosition,
      )
    }
    throw new Error('Last-layer corner positions did not finish')
  }

  // ---------- Stage 7: twist last-layer corners ----------

  private topColorUp(c: CubieCube, pos: number): boolean {
    return stickerOnFace(c, CORNER_FACELETS[pos]!, this.o.U) === this.o.U
  }

  private lastCornersTwist() {
    const top = this.color(this.o.U)
    this.b.startStage(
      'last-corners-twist',
      `Stage 7: Twist ${top} corners`,
      `Twist each corner until ${top} faces up. Don't turn the whole cube during this stage. The cube will look messy halfway through — this is normal. Keep going!`,
    )
    const frontRight = userCorner(this.o, 'U', 'R', 'F')
    for (let loop = 0; loop < MAX_LOOPS; loop++) {
      const positions = this.topCornerPositions()
      if (positions.every((p) => this.topColorUp(this.cube, p))) break

      if (!this.topColorUp(this.cube, frontRight)) {
        const reps = this.repeatUntil(
          ALGORITHMS.lastCornersTwist,
          (c) => this.topColorUp(c, frontRight),
          5,
        )
        this.b.moves(
          Array.from({ length: reps }, () => ALGORITHMS.lastCornersTwist).join(' '),
          `Repeat ${ALGORITHMS.lastCornersTwist} ${times(reps)} until the front-right corner shows ${top} on top.`,
          ALGORITHMS.lastCornersTwist,
        )
        continue
      }
      const k = this.layerTurnsUntil('U', (c) => !this.topColorUp(c, frontRight))!
      this.b.moves(
        layerTurn('U', k),
        `Turn only the top layer to bring the next corner that needs twisting to the front-right.`,
      )
    }

    this.b.startStage('finish', 'Finish', 'Line up the top layer and the cube is solved!')
    const k = this.layerTurnsUntil('U', (c) => isSolved(c))
    if (k === null) throw new Error('Cube is not solved after the last stage')
    this.b.moves(
      layerTurn('U', k),
      'Turn the top layer until all sides match. Your cube is solved!',
    )
  }

  solve(): Solution {
    if (!isSolved(this.cube)) {
      this.cross()
      this.firstCorners()
      this.flip()
      this.middleLayer()
      this.lastCross()
      this.lastEdges()
      this.lastCornersPosition()
      this.lastCornersTwist()
    }
    if (!isSolved(this.cube)) throw new Error('Beginner solver did not solve the cube')
    return this.b.build()
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function times(n: number) {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`
}

export function solveBeginner(cube: ValidCube): Solution {
  return new BeginnerSolver(cube).solve()
}
