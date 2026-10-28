# 0001 — Optimal solver library

**Status:** Decided — `min2phase.js` (under its MIT license)
**Date:** 2026-10-28 (benchmark in Phase 1)

## Need

A Kociemba-style solver that runs in the browser, returns about 20 moves in under 1 second,
and has a license that allows both free and commercial use.

## Options checked (npm, 2026-10-28)

| Package              | Version | License                         | Notes                                                                                        |
| -------------------- | ------- | ------------------------------- | -------------------------------------------------------------------------------------------- |
| `min2phase.js`       | 0.0.4   | MIT **or** GPL-3.0 (we use MIT) | Port of the min2phase solver used by official scramble programs. No dependencies             |
| `cubejs`             | 1.3.2   | MIT                             | Well-known Kociemba port, but lists the whole `npm` 6 tool as a dependency (old, 27 MB)      |
| `kociemba`           | 1.0.1   | MIT                             | Smaller, less used. Not benchmarked                                                          |
| `cubing` (cubing.js) | 0.66.1  | MPL-2.0 or GPL-3.0              | Large toolkit; its solver is marked experimental. Not needed, since we build our own 3D cube |
| `min2phase`          | 0.0.1   | GPL-3.0 only                    | **Rejected:** GPL would force the whole app to be open-source under GPL                      |

## Benchmark

Full results: [docs/benchmarks/solvers.md](../benchmarks/solvers.md) (10,000 random cubes).

On the first 200-cube run, `min2phase.js` was about 50× faster per cube (1.4 ms vs 71 ms),
used about 1 move fewer (20.6 vs 21.7 on average), and set up 10× faster (0.14 s vs 1.5 s).
`cubejs` also returned 14 pointless moves for an already-solved cube.

## Decision

- Use **`min2phase.js`** under its MIT license. Keep its license text with the app's
  third-party notices.
- Remove `cubejs` from the project.
- The library sits behind our own `solver-optimal` module, so it can be swapped later by
  changing only that module.
- The beginner solver is our own code, so it has no license limits.
