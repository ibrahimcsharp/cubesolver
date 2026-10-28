# Test photo and video collection guide

Phase 3 needs at least **300 labeled face photos** to measure color-reading accuracy
(target: at least 98% of stickers read correctly). Phase 5 and 6 need short videos.

Photos and videos are **not stored in git** (they are large). Keep them in
`test-data/photos/` and `test-data/videos/` locally or in a shared drive.
Only the small label files in `test-data/labels/` go into git.

## What to capture

Aim for a spread across all of these. More variety beats more photos of the same setup.

| Variable | Cover at least                                                               |
| -------- | ---------------------------------------------------------------------------- |
| Lighting | Daylight near a window, ceiling light at night, dim room, lamp from one side |
| Problems | Glare spot, shadow across the face, light behind the person                  |
| Cubes    | 3+ brands, including one stickerless cube and one with faded stickers        |
| Cameras  | Built-in laptop webcam, a USB webcam, a phone camera (for the upload mode)   |
| Distance | Close (fills the frame), normal (25–40 cm), far                              |
| Angle    | Straight on, tilted about 15°, tilted about 30°                              |

Use **scrambled** cubes so every face has mixed colors.

## How to capture a set

1. Scramble the cube.
2. Follow the scan order in `PLAN.md` section 4.3 (green front / white top first).
3. Take one photo per face. For video, record the full 6-face scan slowly in one clip.

## File names

```
photos/<set-id>_<face>.jpg      e.g.  photos/s001_green.jpg
videos/<set-id>.mp4             e.g.  videos/s001.mp4
labels/<set-id>.json
```

`<set-id>` is `s` + a 3-digit number. `<face>` is the center color facing the camera.

## Label file format

One JSON file per set. For each face, list the 9 sticker colors **as seen in the photo**,
row by row from top-left to bottom-right. Use: `white`, `yellow`, `green`, `blue`, `red`, `orange`.

```json
{
  "id": "s001",
  "lighting": "daylight",
  "problems": ["glare"],
  "cube": "GAN 356",
  "camera": "laptop-webcam",
  "distance": "normal",
  "angle": "straight",
  "faces": {
    "green": ["red", "green", "white", "blue", "green", "yellow", "orange", "orange", "green"],
    "red": ["...9 colors..."],
    "blue": ["...9 colors..."],
    "orange": ["...9 colors..."],
    "white": ["...9 colors..."],
    "yellow": ["...9 colors..."]
  }
}
```

Tip: a quick way to label is to enter the cube on the app's **Enter colors by hand** screen
(Phase 2), which will be able to export this file.
