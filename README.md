# CubeSolver

Scan a Rubik's cube with your webcam and get a step-by-step solution: a short optimal
solution or an easy 7-stage beginner guide. Follow it live with arrows over your camera
image, or download it as a PDF or video. Everything runs in the browser.

See **[PLAN.md](PLAN.md)** for the full product plan and phases.

## Requirements

- Node.js 22.22 or newer (24 recommended)

## Commands

| Command                       | What it does                                                                |
| ----------------------------- | --------------------------------------------------------------------------- |
| `npm install`                 | Install dependencies                                                        |
| `npm run dev`                 | Start the dev server at http://localhost:5173                               |
| `npm run build`               | Type-check and build to `dist/`                                             |
| `npm run preview`             | Serve the built app                                                         |
| `npm run lint`                | Lint with oxlint                                                            |
| `npm run format`              | Format all files with Prettier                                              |
| `npm test`                    | Run unit tests (Vitest)                                                     |
| `npm run test:e2e`            | Run browser tests (Playwright; first run `npx playwright install chromium`) |
| `npm run check`               | Lint + format check + tests + build (same as CI)                            |
| `npm run bench:solvers`       | 10,000-cube solver benchmark (slow)                                         |
| `node scripts/make-icons.mjs` | Redraw the app icons in `public/`                                           |

## Project layout

```
src/
  app/          Router and page layout
  pages/        Screens (Home, Scan, Upload, Manual, Check, Solution, Notation)
  components/   Shared UI (components/ui = shadcn-style building blocks)
  store/        App state (Zustand)
  modules/      Core features, one folder each:
    camera/  vision/  cube/  solver-optimal/  solver-beginner/
    solution/  renderer3d/  live-guide/  export/
e2e/            Playwright browser tests
test-data/      Guide and labels for test cube photos/videos
docs/decisions/ Technical decisions
```

## Install and offline

The built app is installable (browser menu → Install) and works offline after the first visit. The service worker is only active in the built app (`npm run build && npm run preview`), not in `npm run dev`.

## Deployment

Static site. `vercel.json` is set up for Vercel (connect the GitHub repo in Vercel and every
push to `main` deploys). Netlify works too: build command `npm run build`, output `dist`.
