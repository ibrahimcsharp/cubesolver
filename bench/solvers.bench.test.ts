/**
 * Phase 1 acceptance benchmark: 10,000 random scrambles through each solver.
 * Run with: npm run bench:solvers   (writes docs/benchmarks/solvers.md)
 */
import { writeFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import {
  randomCube,
  seededRandom,
  STANDARD_CENTERS,
  toFacelets,
  validateColors,
  type ValidCube,
} from '@/modules/cube'
import { verifySolution, type Solution } from '@/modules/solution'
import { solveBeginner } from '@/modules/solver-beginner'
import { solveOptimal } from '@/modules/solver-optimal'
import { min2phaseEngine, type SolverEngine } from '@/modules/solver-optimal/engines'

const N = Number(process.env.BENCH_N ?? 10_000)

function cubes(): ValidCube[] {
  const rand = seededRandom(2026)
  return Array.from({ length: N }, () => {
    const colors = [...toFacelets(randomCube(rand))].map((ch) => STANDARD_CENTERS[ch as 'U'])
    const r = validateColors(colors)
    if (!r.ok) throw new Error('bad cube')
    return r
  })
}

type Row = {
  name: string
  init: number
  solved: number
  avg: number
  max: number
  avgMs: number
  maxMs: number
}

function run(name: string, solve: (c: ValidCube) => Solution, init = 0): Row {
  let solved = 0,
    total = 0,
    max = 0,
    maxMs = 0
  const start = performance.now()
  for (const c of cubes()) {
    const t = performance.now()
    const s = solve(c)
    maxMs = Math.max(maxMs, performance.now() - t)
    if (verifySolution(s).ok) solved++
    total += s.moveCount
    max = Math.max(max, s.moveCount)
  }
  const ms = performance.now() - start
  return { name, init, solved, avg: total / N, max, avgMs: ms / N, maxMs }
}

function engineRow(engine: SolverEngine): Row {
  const t = performance.now()
  engine.init()
  const init = performance.now() - t
  return run(`Optimal — ${engine.name}`, (c) => solveOptimal(c, engine), init)
}

it(`solves ${N} random cubes with every solver`, { timeout: 3_600_000 }, () => {
  const rows = [engineRow(min2phaseEngine), run('Beginner (our own)', solveBeginner)]
  const f = (x: number, d = 1) => x.toFixed(d)
  const md = [
    '# Solver benchmark',
    '',
    `${N.toLocaleString('en-US')} random cube states (seed 2026), Node ${process.version}, ${new Date().toISOString().slice(0, 10)}.`,
    'Every solution was replayed from the start and checked to end solved.',
    '',
    '| Solver | Solved correctly | Avg moves | Max moves | Avg time / cube | Slowest cube | Setup time |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.name} | ${r.solved.toLocaleString('en-US')} / ${N.toLocaleString('en-US')} | ${f(r.avg)} | ${r.max} | ${f(r.avgMs, 2)} ms | ${f(r.maxMs)} ms | ${r.init ? f(r.init, 0) + ' ms' : '—'} |`,
    ),
    '',
  ].join('\n')
  writeFileSync('docs/benchmarks/solvers.md', md)
  process.stdout.write('\n' + md + '\n')
  for (const r of rows) expect(r.solved, r.name).toBe(N)
})
