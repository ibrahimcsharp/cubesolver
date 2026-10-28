# Solver benchmark

10,000 random cube states (seed 2026), Node v24.21.0, 2026-10-28.
Every solution was replayed from the start and checked to end solved.

| Solver                 | Solved correctly | Avg moves | Max moves | Avg time / cube | Slowest cube | Setup time |
| ---------------------- | ---------------- | --------- | --------- | --------------- | ------------ | ---------- |
| Optimal — min2phase.js | 10,000 / 10,000  | 20.6      | 21        | 1.20 ms         | 69.1 ms      | 134 ms     |
| Optimal — cubejs       | 10,000 / 10,000  | 21.7      | 22        | 63.89 ms        | 1644.9 ms    | 1303 ms    |
| Beginner (our own)     | 10,000 / 10,000  | 155.6     | 234       | 1.60 ms         | 211.8 ms     | —          |

`cubejs` was removed after this run (see docs/decisions/0001-solver-library.md), so `npm run bench:solvers` now measures only `min2phase.js` and the beginner solver.
