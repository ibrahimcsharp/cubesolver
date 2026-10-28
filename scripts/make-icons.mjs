// Draws the app icons (a cube face) as PNG files. Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [15, 17, 21]
const FACE = [
  ['#009b48', '#f5f5f5', '#b71234'],
  ['#ff5800', '#009b48', '#0046ad'],
  ['#ffd500', '#b71234', '#009b48'],
]
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5)
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
      raw[o + 3] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
const inRoundRect = (x, y, x0, y0, w, h, r) => {
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r)
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

/** `pad`: share of the icon left as margin (maskable icons need room to be cropped). */
function icon(size, { pad, fullBleed }) {
  return png(size, (x, y) => {
    const s = size
    if (!fullBleed && !inRoundRect(x, y, 0, 0, s, s, s * 0.2)) return [0, 0, 0, 0]
    const inner = s * (1 - 2 * pad)
    const x0 = s * pad
    const cell = inner / 3
    const c = Math.floor((x - x0) / cell)
    const r = Math.floor((y - x0) / cell)
    if (c >= 0 && c < 3 && r >= 0 && r < 3) {
      const gap = cell * 0.07
      if (
        inRoundRect(
          x,
          y,
          x0 + c * cell + gap,
          x0 + r * cell + gap,
          cell - 2 * gap,
          cell - 2 * gap,
          cell * 0.14,
        )
      )
        return [...hex(FACE[r][c]), 255]
    }
    return [...BG, 255]
  })
}

writeFileSync('public/pwa-192.png', icon(192, { pad: 0.14, fullBleed: false }))
writeFileSync('public/pwa-512.png', icon(512, { pad: 0.14, fullBleed: false }))
writeFileSync('public/pwa-maskable-512.png', icon(512, { pad: 0.22, fullBleed: true }))
writeFileSync('public/apple-touch-icon.png', icon(180, { pad: 0.14, fullBleed: true }))
console.log('icons written')
