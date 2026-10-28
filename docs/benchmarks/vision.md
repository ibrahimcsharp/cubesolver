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
