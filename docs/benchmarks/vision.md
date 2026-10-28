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
