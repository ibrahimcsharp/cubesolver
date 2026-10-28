# CubeSolver — Complete Project Plan

> Planning document only. No code is written until this plan is approved.

---

## 1. Product summary

A **web app** that runs in the browser on a laptop or PC. The user shows a scrambled 3×3 Rubik's cube to the webcam. The app reads all 54 stickers and works out a solution. It then teaches the user to solve the cube step by step.

### Ways to give the app the cube (input)

| # | Input mode | How it works |
|---|---|---|
| 1 | **Photo scan** | The user shows each of the 6 faces to the webcam and the app takes a picture of each (manually or automatically) |
| 2 | **Live video scan** | The user slowly turns the cube in front of the webcam and the app captures each face automatically |
| 3 | **Upload photos** | The user uploads 6 photos of the faces (from a phone, etc.) |
| 4 | **Upload video** | The user uploads a short video of the cube being turned and the app pulls the 6 faces from it |
| 5 | **Manual entry (54 stickers)** | The user clicks each of the 54 squares on a flat cube map and picks its color. This is a fallback and also the correction screen |

### Ways the app gives the solution (output)

| # | Output | Description |
|---|---|---|
| 1 | **On-screen steps** | A numbered list of moves with plain-English text and a small picture for each move |
| 2 | **3D animation player** | A 3D cube in the user's real colors performs each move, with Play / Pause / Next / Back / Speed controls |
| 3 | **Live guided mode** | Arrows drawn over the live webcam image show the next turn, and the app checks that the user did it correctly |
| 4 | **PDF file** | A printable step-by-step solution booklet |
| 5 | **Video file (MP4)** | A downloadable video of the solution with captions, arrows and stage titles |

### Solution styles (toggle anywhere)

- **Optimal (Fast):** about 20 moves. Best for experienced users.
- **Beginner (Learn):** about 80–120 moves, grouped into 7 named stages, each explained. Best for learning.

The user can switch between them at any time. Every output (steps, 3D, live, PDF, video) works with both styles.

---

## 2. Technology stack

Everything runs **in the browser**. No server is needed for the core features. The result is fast (live mode has no delay), private (the camera feed never leaves the computer) and cheap to host.

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Framework / build tool | React + Vite |
| UI components | Tailwind CSS + shadcn/ui |
| App state | Zustand |
| Webcam | Browser camera API (`getUserMedia`) |
| Computer vision | OpenCV.js running in a Web Worker (background thread) |
| Optimal solver | Kociemba two-phase algorithm (`cubejs` or `min2phase.js`; license to be checked) |
| Beginner solver | Our own implementation of the layer-by-layer method (Section 7) |
| 3D cube | three.js via React Three Fiber |
| Live arrows overlay | HTML canvas layered over the video |
| Video export | Browser MediaRecorder (WebM), converted to MP4 with ffmpeg.wasm |
| PDF export | jsPDF (with cube diagrams drawn as SVG) |
| Testing | Vitest (logic) + Playwright (full browser tests) |
| Installable / offline | PWA (vite-plugin-pwa) |
| Hosting | Vercel or Netlify (static) |
| Backend | None in version 1. Supabase later if accounts or history are wanted |

---

## 3. Screens and user flow

```
Home ──► Choose input ──► Scan / Upload / Manual ──► Check & Correct ──► Choose style ──► Solution
                                                                    (Optimal / Beginner)   │
                                                 ┌───────────────┬──────────────┬──────────┼────────────┐
                                              Steps list     3D player     Live guided   PDF        Video
```

1. **Home:** "Scan my cube", "Upload photos/video", "Enter colors by hand", "How to use" and "Learn notation".
2. **Camera permission screen:** explains why the camera is needed. Nothing is uploaded.
3. **Scan screen:** live video, a 3×3 guide box, on-screen instructions, 6 progress dots (one per face) and a mini cube map that fills in as faces are scanned.
4. **Check & Correct screen:** a flat cube map (cross shape) of all 54 stickers. Problem stickers are highlighted, and the user clicks a sticker to change its color.
5. **Solution screen:** tabs for **Steps**, **3D Player** and **Live Guide**, the **Optimal / Beginner** toggle, and **Download PDF** and **Download Video** buttons.

---

## 4. Scanning instructions (what the user is told)

### 4.1 Before scanning (shown once)
- Sit facing the webcam in a well-lit room. Avoid strong light behind you.
- Hold the cube about 25–40 cm (10–15 inches) from the camera.
- Hold it by the edges so your fingers don't cover the stickers.
- Hold one face flat toward the camera and fill the guide box.
- Hold still for about 1 second. The app captures the face when the box turns green.

### 4.2 Standard holding position
Hold the cube with the **white center on top** and the **green center facing the camera**. The center stickers never move, so they tell the app which face is which.

### 4.3 Scan order (6 faces)
Each step is shown with an animated picture of the hand movement.

| Step | Face toward camera | Face on top | Instruction shown to user |
|---|---|---|---|
| 1 | **Green** | White | "Hold green toward the camera, white on top." |
| 2 | **Red** | White | "Turn the whole cube to the LEFT once (red now faces you). Keep white on top." |
| 3 | **Blue** | White | "Turn the whole cube LEFT again (blue faces you)." |
| 4 | **Orange** | White | "Turn the whole cube LEFT again (orange faces you)." |
| 5 | **White** | Blue | "Turn LEFT once more to bring green back to the front. Now tip the top of the cube TOWARD you so white faces the camera." |
| 6 | **Yellow** | Green | "Tip it back, then tip the top AWAY from you so yellow faces the camera." |

Because each face is shown in a known position, the app knows how each face is rotated as well as which stickers it has.

### 4.4 Video scan
- Same order and holding rules, but the user simply moves from face to face slowly.
- The app saves a face when **(a)** the image has held still for about 0.5 s and **(b)** the center color hasn't been captured yet.
- The face's progress dot fills in, with a "click" sound and a green flash.

### 4.5 Upload mode
- **Photos:** the user uploads 6 images and the app shows which face it detected in each. The user can reorder them or tell the app which face is on top.
- **Video:** the app goes through the video frame by frame using the same rules as the live video scan.

### 4.6 If scanning goes wrong
- **"Too dark" / "Glare detected":** a tip to move away from the window or tilt the cube.
- **"Face not found":** a tip to move closer and fill the box.
- Any single face can be **retaken** by tapping its progress dot.

---

## 5. Color recognition (how the app reads stickers)

1. Find the face. Version 1 uses the fixed on-screen guide box. A later version finds the cube in the image on its own (edge and contour detection plus a perspective fix) so it can be held at an angle.
2. Split the face into a 3×3 grid and sample the **center area of each sticker**, ignoring the edges and shiny spots.
3. Convert the colors to **LAB / HSV** color space, which handle lighting changes better.
4. Use the **6 center stickers as reference colors**.
5. Sort all 54 stickers into 6 groups, **exactly 9 per color**. This rule fixes most red/orange and white/yellow mix-ups.
6. Give each sticker a **confidence score**. Low-confidence stickers are highlighted on the Check & Correct screen.
7. **Optional calibration:** the user shows each center once in their own lighting, so cubes with unusual colors are also supported.

---

## 6. Checking the cube (validation)

Before solving, the app checks that the scan is a real, solvable cube:

| Check | Message if it fails |
|---|---|
| 9 stickers of each color | "We found 10 red and 8 orange — please check the highlighted stickers." |
| 6 different center colors | "Two faces have the same center — please rescan face X." |
| Every corner and edge piece is a real piece (e.g. no red–orange edge) | "This piece can't exist — please check it." |
| Corner twist, edge flip and swap (parity) rules | "The cube seems to have a twisted corner or was reassembled incorrectly." |

If a check fails, the user goes to the **Check & Correct** screen with the suspect stickers highlighted.

---

## 7. How the cube is solved (clear instructions)

### 7.1 Move notation (taught on the "Learn notation" screen and in every PDF)

Hold the cube so one face points at you. The letters name the faces:

| Letter | Face | Clockwise means… |
|---|---|---|
| **F** | Front (facing you) | Turn the front face clockwise, as if looking at it |
| **B** | Back | Clockwise, as if looking at the back face |
| **U** | Up (top) | Top layer turns to the left |
| **D** | Down (bottom) | Bottom layer turns to the right |
| **R** | Right | Right side turns upward, away from you |
| **L** | Left | Left side turns downward, toward you |

- **A letter alone** (`R`) = turn that face **90° clockwise**.
- **A letter with an apostrophe** (`R'`, said "R prime") = turn it **90° counter-clockwise**.
- **A letter with 2** (`R2`) = turn it **180°** (two quarter turns, either direction).
- **Whole-cube turns** (shown as a picture of a hand turning the full cube, never as letters, for beginners):
  - "Turn the whole cube upside down", "Turn the whole cube to the left", and so on.

### 7.2 Optimal method (Fast mode)
- Uses the **Kociemba two-phase algorithm**, which finds a solution of about 20 moves in under a second.
- Shown as a single list, for example `R U2 F' D R2 B …`, with each move animated and explained.
- The cube is held in one position for the whole solve, so there are no whole-cube turns.

### 7.3 Beginner method (Learn mode) — 7 stages

The app works out the exact moves for the user's own cube. It also shows **what the stage is trying to achieve** and the **standard pattern (algorithm)** it uses, so the user learns the method instead of only copying moves.

**Starting position for stages 1–2:** white center on top.

| Stage | Goal | How (what the app shows) |
|---|---|---|
| **1. White cross** | Make a white "+" on top, with each edge's side color matching the center beside it | The app gives exact moves. Explanation: "Bring each white edge up to the top so its side color lines up with the matching center." |
| **2. White corners** | Finish the whole white face and the first layer | Put the corner directly **below** its target spot (bottom layer, front-right), then repeat **`R' D' R D`** until the corner is solved. Do the same for all 4 corners. |
| — | **Turn the cube upside down** | "Now hold the cube with yellow on top. White is on the bottom from here on." |
| **3. Middle layer** | Place the 4 middle-layer edges | Line up the top edge with its center. If it belongs on the **right**: **`U R U' R' U' F' U F`**. If it belongs on the **left**: **`U' L' U L U F U' F'`** |
| **4. Yellow cross** | Make a yellow "+" on top (the side colors don't matter yet) | Use **`F R U R' U' F'`**. Dot → L-shape → line → cross. The app shows how to hold the L-shape (top-left) or the line (horizontal) before each use. |
| **5. Yellow edges** | Match the yellow edges' side colors to their centers | Use **`R U R' U R U2 R'`**, then **`U`** if needed. The app shows which way to hold the cube. |
| **6. Position yellow corners** | Put each yellow corner in its correct spot (it may still be twisted) | Use **`U R U' L' U R' U' L`**. Hold an already-correct corner at front-right, repeating as needed. |
| **7. Twist yellow corners** | Finish the cube | Hold the cube still with yellow on top. For the front-right corner, repeat **`R' D' R D`** until its yellow sticker faces up. Then turn **only the top layer (`U`)** to bring the next corner to front-right, and repeat. **Warning shown:** "The cube will look messy halfway through — this is normal. Keep going!" |

**Finish:** "Turn the top layer until all sides match. Your cube is solved! 🎉"

### 7.4 Toggle behavior
- Both solvers produce the same kind of output: a list of moves, each with its **stage**, **explanation** and **cube state after the move**.
- So the Steps list, 3D player, live guided mode, PDF and video all work with either style without changes.
- Switching styles regenerates the solution instantly, and the user keeps their scan.

---

## 8. Live guided mode

1. **Start:** "Hold the cube with [color] facing the camera and [color] on top." The app checks the front face matches before starting.
2. **Show the move:** a large curved **arrow over the live video** on the layer to turn, plus the text, for example "Turn the RIGHT side UP (R)". A small 3D cube in the corner shows the same move.
3. **Wait:** the app ignores the image while hands are moving and waits until it has held still for about 0.5 s.
4. **Check:** the app reads the front face and compares it with what it should look like after the move.
   - ✅ **Correct:** green tick, a short sound, then the next move.
   - ❌ **Wrong:** "That doesn't look right. Try undoing your last turn (shown)." The arrow for the undo move is drawn.
   - ❓ **Lost:** a "Rescan my cube" button rescans and builds a new solution from where the user is now.
5. **Controls:** Pause, Repeat move, Back one move, Skip check (for poor lighting), and voice read-out of each move (optional, using the browser's speech feature).
6. **Whole-cube turns** in beginner mode: an animated hand picture, then the app confirms the new front and top colors before continuing.
7. **Progress bar:** "Stage 3 of 7 — Middle layer — move 14 of 112."

---

## 9. Output files

### 9.1 PDF solution booklet
- **Page 1, cover:** title, date, solution style (Optimal / Beginner), total moves, and a **flat cube map of the scanned cube** so the user can check it matches.
- **Page 2, how to read this guide:** the notation table (Section 7.1) with pictures, and the starting position ("Hold white on top, green facing you").
- **Solution pages:**
  - Beginner: **one section per stage** with the stage goal and explanation, then the moves.
  - Each move shows its **number**, **notation**, **plain-English text** and a **small cube picture with an arrow**, at 6–8 moves per page in a grid.
  - Optimal: the same move grid without stage sections.
- **Last page:** "Solved!" image and tips ("If you get lost, rescan your cube in the app").
- **Formats:** A4 and US Letter, with a printer-friendly black & white option.

### 9.2 Video solution (MP4)
- **Resolution:** 720p or 1080p, chosen by the user.
- **Content:**
  1. An intro showing the scrambled cube **in the user's own colors**, plus a "Hold your cube like this" shot.
  2. For each move: the 3D cube turns, an arrow highlights the layer, and a caption shows notation and text, for example "R — Right side up".
  3. Beginner mode: a **title card for each stage** with its goal, plus a short pause.
  4. Move counter and stage progress in the corner.
  5. Ending: the solved cube spins with a "Solved!" message.
- **Options:** speed (slow / normal / fast), and a pause between moves (0.5–2 s).
- **Made entirely in the browser** (record the 3D animation, then convert to MP4). Nothing is uploaded.
- **Later:** voice narration.

---

## 10. App structure (modules)

| Module | Responsibility |
|---|---|
| **Camera** | Webcam access, camera selection, frame capture |
| **Vision** | Finding the face, sampling stickers, color sorting, stability detection (Web Worker) |
| **Cube model** | Stores the 54 stickers, applies moves, checks validity, converts to the solver's format |
| **Optimal solver** | Kociemba wrapper |
| **Beginner solver** | The 7-stage layer-by-layer method with explanations |
| **Solution format** | The shared list of moves with stage, explanation and state after each move |
| **3D renderer** | Draws and animates the cube |
| **Live guide** | Arrow overlay, move checking, undo and rescan logic |
| **Exporters** | PDF builder, video recorder and converter |
| **UI** | Screens, toggle, instructions, help, accessibility |

**Cube state format:** the standard 54-letter "facelet" string in the order Up, Right, Front, Down, Left, Back, which is the format the Kociemba solver expects.

---

## 11. Development phases and deliverables

| Phase | Deliverable | Done when… | Time |
|---|---|---|---|
| **0. Setup** | Project skeleton, tooling, auto-deploy, collection of test cube photos (different rooms, lights, cubes) | App deploys to a test URL | 3 days |
| **1. Cube model + both solvers** | Cube model, validation, Optimal solver, Beginner solver with stage explanations | 10,000 random scrambles all solved correctly by **both** solvers | 2 weeks |
| **2. Manual entry + Steps list** | 54-sticker clickable map, Steps screen, Optimal/Beginner toggle, notation help screen | The user can enter a cube by hand and follow the text steps to a solved cube | 1 week |
| **3. Photo scan** | Webcam scan with guide box, color reading, Check & Correct screen, photo upload. **Early prototype of live face detection** (main risk) | ≥ 98% of stickers read correctly on the test photos | 2 weeks |
| **4. 3D player** | Animated 3D cube with controls, in the user's colors | Smooth playback of both solution styles | 1.5 weeks |
| **5. Video scan** | Automatic face capture from live video and uploaded video | Full scan in under 60 s without pressing buttons | 1.5 weeks |
| **6. Live guided mode** | Arrow overlay, move checking, undo / rescan | A first-time user solves a real cube using only live mode | 2.5 weeks |
| **7. PDF + video export** | PDF booklet, MP4 video, PWA install | Files download and open correctly in Chrome, Edge and Firefox | 1 week |
| **8. Testing + launch** | Lighting and cube-brand testing, accessibility review, bug fixes, public release | All acceptance tests pass | 1 week |

**Total:** about 13 weeks for one developer.

---

## 12. Testing plan

- **Solver tests:** 10,000 random scrambles for each solver. Every solution must end with a solved cube. Optimal must average ≤ 22 moves.
- **Vision tests:** a labeled set of at least 300 face photos (daylight, room light, dim light, glare, 3+ cube brands). Target ≥ 98% of stickers read correctly.
- **Live mode tests:** recorded videos of real solves, checking that correct moves are confirmed and wrong moves are caught.
- **Browser tests:** Chrome, Edge, Firefox and Safari on Windows and macOS laptops, with built-in and USB webcams.
- **User tests:** 5–10 people who can't solve a cube try to solve it with the app. Success means at least 80% finish.
- **Performance:** solution in under 1 s, live mode at 20+ frames per second on a mid-range laptop.

---

## 13. Risks and how they're handled

| Risk | How it's handled |
|---|---|
| Poor lighting, glare, shadows | Guide box, light/glare warnings, calibration, Check & Correct screen |
| Red vs orange, white vs yellow | LAB color space, comparison to the center stickers, the 9-per-color rule |
| User holds the cube the wrong way | Animated instructions, center-color checks, validity checks, retake any face |
| Live mode loses track of the cube | Wait for stillness, undo hint, one-click rescan and re-solve |
| Slow older laptops | Vision in a background thread, lower processing resolution, "Skip check" option |
| Solver library license | Check licenses in Phase 0; the Beginner solver is our own code |
| Webcam blocked or missing | Upload and Manual entry modes always work |

---

## 14. Out of scope for version 1
- 2×2, 4×4 and other puzzles
- Native phone apps (the web app should still work in phone browsers)
- User accounts, saved history, speed-solving timer
- Voice narration in the exported video

---

## 15. Open questions
1. App name and branding?
2. Should the app support languages other than English in version 1?
3. Commercial or free/open-source? This affects the choice of solver library.
4. Is version 1 for desktop/laptop only, or should phone browsers also be fully supported?
