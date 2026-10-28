# 0002 — PDF, video and offline libraries

**Status:** Decided
**Date:** 2026-10-28 (Phase 7)

| Need                         | Choice                                                                  | License    | Why                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------- |
| PDF booklet                  | `jspdf`                                                                 | MIT        | Makes PDFs in the browser; vector text and shapes, JPEG pictures                    |
| MP4 video                    | Browser `VideoEncoder` (WebCodecs) + `mediabunny` to write the MP4 file | MPL-2.0    | Frames are drawn and encoded one by one, much faster than real time; small download |
| Video fallback               | `MediaRecorder` (built into browsers)                                   | —          | WebM recorded in real time where WebCodecs is missing                               |
| Offline / install            | `vite-plugin-pwa` (Workbox)                                             | MIT        | Web app manifest + service worker that saves the app for offline use                |
| Checking PDFs in development | `pdfjs-dist` (dev only)                                                 | Apache-2.0 | Renders PDF pages to pictures for checking; not shipped in the app                  |

## Changed from the plan

The plan said ffmpeg.wasm. It was dropped: it is a ~30 MB download, needs special server headers for its fast mode, and isn't needed now that browsers can encode video themselves (WebCodecs).

## MPL-2.0 note

`mediabunny` is MPL-2.0, which allows use in free and commercial apps. Only changes made _to mediabunny's own files_ would have to be shared. We use it unchanged.
