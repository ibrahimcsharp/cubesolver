import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Long-running solver benchmark; not part of `npm test`.
export default mergeConfig(
  viteConfig,
  defineConfig({ test: { environment: 'node', include: ['bench/**/*.bench.test.ts'] } }),
)
