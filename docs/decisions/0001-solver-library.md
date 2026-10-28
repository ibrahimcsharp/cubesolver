# 0001 — Optimal solver library

**Status:** Accepted (final pick confirmed by benchmark in Phase 1)
**Date:** 2026-10-28

## Need

A Kociemba-style solver that runs in the browser, returns about 20 moves in under 1 second,
and has a license that allows both free and commercial use.

## Options checked (npm, 2026-10-28)

| Package              | Version | License                              | Notes                                                                                                        |
| -------------------- | ------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `cubejs`             | 1.3.2   | MIT                                  | Well-known Kociemba port. Needs a one-time table setup (a few seconds) — run it in a Web Worker at app start |
| `min2phase.js`       | 0.0.4   | MIT **or** GPL-3.0 (our choice: MIT) | Port of the min2phase solver used by official scramble programs. Very fast                                   |
| `kociemba`           | 1.0.1   | MIT                                  | Smaller, less used                                                                                           |
| `cubing` (cubing.js) | 0.66.1  | MPL-2.0 or GPL-3.0                   | Large toolkit; its solver is marked experimental. Not needed, since we build our own 3D cube                 |
| `min2phase`          | 0.0.1   | GPL-3.0 only                         | **Rejected:** GPL would force the whole app to be open-source under GPL                                      |

## Decision

- Use **`cubejs`** as the main option, with **`min2phase.js` (under MIT)** as the backup.
- In Phase 1, benchmark both on 10,000 random scrambles (speed, average move count, bundle
  size) and keep the better one.
- The solver sits behind our own `solver-optimal` module, so swapping libraries later
  changes only that module.
- The beginner solver is our own code, so it has no license limits.
