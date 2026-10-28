/**
 * Minimum-cost assignment (Hungarian algorithm, O(n³)). Used to give each of
 * the 54 stickers a color so that every color gets exactly 9 stickers and the
 * total color difference is as small as possible.
 *
 * cost[i][j] = cost of giving row i column j. Returns, for each row, its column.
 */
export function assign(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length
  const INF = Number.POSITIVE_INFINITY
  const u = new Float64Array(n + 1)
  const v = new Float64Array(n + 1)
  const p = new Int32Array(n + 1) // p[j] = row matched to column j (1-based)
  const way = new Int32Array(n + 1)

  for (let i = 1; i <= n; i++) {
    p[0] = i
    let j0 = 0
    const minv = new Float64Array(n + 1).fill(INF)
    const used = new Uint8Array(n + 1)
    do {
      used[j0] = 1
      const i0 = p[j0]!
      let delta = INF
      let j1 = 0
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!
        if (cur < minv[j]!) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j]! < delta) {
          delta = minv[j]!
          j1 = j
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]!] = u[p[j]!]! + delta
          v[j] = v[j]! - delta
        } else {
          minv[j] = minv[j]! - delta
        }
      }
      j0 = j1
    } while (p[j0] !== 0)
    do {
      const j1 = way[j0]!
      p[j0] = p[j1]!
      j0 = j1
    } while (j0)
  }

  const result = new Array<number>(n).fill(-1)
  for (let j = 1; j <= n; j++) if (p[j]! > 0) result[p[j]! - 1] = j - 1
  return result
}
