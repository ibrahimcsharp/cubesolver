# Vision

Reads sticker colors from camera frames and photos. Plain pixel math on RGBA arrays (no OpenCV yet), so it runs the same in the browser, a Web Worker, and tests.

- `sample.ts`: samples the 9 stickers inside a box (middle of each cell, ignores glare and shadows) and flags glare, darkness and "doesn't look like a face".
- `classify.ts`: turns 54 samples into 6 colors. It corrects each photo's brightness and tint, uses the 9-per-color rule (Hungarian method) and gives each sticker a confidence score.
- `faceMapping.ts`: which cube sticker each image cell is, for each scan step.
- `gridFinder.ts`: PROTOTYPE that finds a cube face anywhere in a photo. Used to place the crop box on uploads; Phase 5 builds automatic capture on it.
- `autoCapture.ts`: decides when to save a side during a video scan (steady for 0.6 s, right side, not the last side again). Learns the room light from the middle stickers already captured.
- `synthetic.ts`: draws fake cube photos for tests. Results are in `docs/benchmarks/vision.md`.

**Built in:** Phase 3 (photos, done), Phase 5 (video, done), Phase 6 (live checks)
