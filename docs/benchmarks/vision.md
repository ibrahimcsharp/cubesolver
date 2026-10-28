# Color reading results (synthetic photos)

Measured by `src/modules/vision/vision.test.ts` on computer-generated cube photos: stickers with black gaps, per-cube plastic color shifts, camera noise, uneven light, and glare. Each row is 25–40 full 6-photo scans (1,350–2,160 stickers). Run `npx vitest run src/modules/vision --silent=false` to see the numbers.

These are **not** real photos. They show the method works and catch regressions. The Phase 3 target (98% on real photos) still needs the labeled photo set described in `test-data/README.md`.

| Condition                                                                               | Stickers read correctly                                                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Daylight, warm bulb, cool LED, dim room, side lamp, glare (same light for all 6 photos) | 100% each                                                                                                           |
| Very warm light / dark corner                                                           | 100%                                                                                                                |
| Warm light + glare + uneven light                                                       | 99.6% (half of the mistakes flagged for checking)                                                                   |
| Each photo with its own brightness and slight tint (camera auto-exposure)               | 100%                                                                                                                |
| Each photo in completely different light (e.g. different rooms)                         | about 80%; the app asks users to take all photos in the same light, and the cube checks catch most of these mix-ups |

Finding the cube face in a photo (prototype): 30 of 30 test photos, with the box within 10% of the true position and size.

## What changed because of these tests

The first version compared every sticker against the 6 center stickers directly. When photos had different lighting, red and orange swapped (69% correct). The reader now works out a brightness and tint correction for each photo while it reads the colors (see `classify.ts`).

## Automatic capture (Phase 5)

Measured by `src/modules/vision/autoCapture.test.ts`: simulated hand-held scans, 10 frames a second, about 1 s of turning between sides and 1.2 s holding each side still (about 13 s per scan).

| Condition                                    | Result                                                                                 |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| Daylight, warm bulb, dim room (8 scans each) | All 6 sides captured in order, every time, hands-free; 98%+ of stickers read correctly |
| Side held still for 4 s                      | Not captured twice                                                                     |
| Wrong side facing the camera                 | Not captured                                                                           |
| Cube moving                                  | Not captured                                                                           |

A browser test also records a real WebM video of a cube being turned through the 6 sides and uploads it: all 6 sides are found and read. A first version missed the last side, because the end of a recording can be cut short; the reader now always checks the final frame.

## Fix: "not a real cube" errors and low light (2026-10-29)

Reported by the user: colors weren't read reliably, especially in low light, and the app kept saying the cube wasn't real.

**Cause found:** the reader assumed every side was shown in the asked order and the right way up. The old instructions were also easy to misread ("red now faces you" meant the camera; tipping the top toward you shows the wrong side). One side turned the wrong way put its 9 stickers in the wrong places, and the cube looked impossible.

Simulated scans of 30 random cubes each (`src/modules/vision/scan-sim.ts`):

| Case                                                                      | Before: real cube | After: exactly right |
| ------------------------------------------------------------------------- | ----------------- | -------------------- |
| Normal light, shown as asked                                              | 30/30             | 30/30                |
| Normal light, sides turned                                                | **0/30**          | 30/30                |
| Any order + turned, normal / evening / dim lamp / nearly dark / very warm | **0/30**          | 30/30 each           |
| Any order + turned, warm light with glare                                 | 0/30              | 28/30                |
| Very dim webcam / grey and grainy / candle-like (6 frames averaged)       | –                 | 29–30/30             |

**What changed:**

- `reconstruct.ts`: works out which side each capture is (the 6 middle colors matched all at once), which way up it was held (all 4,096 combinations tried), and swaps the colors of the least certain stickers when that makes the cube real (those are outlined for checking). It also balances the camera's white balance using the whole cube, and keeps whichever reading is better.
- Captures average all the frames from when the cube was held still, which cancels camera grain.
- The "is a cube side in the box" check judges evenness against the picture's own grain, compares the two halves of each sticker area (so a cube held half a sticker off is rejected even in dim light), ignores glare pixels, and only refuses nearly black pictures.
- Scan screen: any order and any way up; clearer wording; **Screen light** (bright white page to light the cube); camera brightness and torch controls where the camera supports them.

## Fix: many impossible pieces after a real webcam scan (2026-10-29)

A real scan showed 11 impossible corners and edges, too many for a few misread stickers. Likely causes, now handled:

| Cause                                                                  | Fix                                                                                                                                                                        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A wall, shirt or hand in the box was saved as a side (9 "even" colors) | A side is only accepted if the lines between stickers are dark (real cubes: 0.71+ contrast in every test light; plain walls: rejected 20 of 20). "Capture now" refuses too |
| Cube smaller than the box or off-center, so each square read a mix     | The cube is found anywhere in the picture about twice a second, and the box follows it (works in dim light after making the finder judge contrast relative to brightness)  |
| Webcam sends mirror images (common with some Windows drivers)          | Reading also tries every side flipped and keeps the real cube                                                                                                              |
| One bad photo                                                          | The Check screen names the side to retake and outlines its photo; all of that photo's stickers are flagged                                                                 |
