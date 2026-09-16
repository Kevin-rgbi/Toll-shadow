import { execSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

/**
 * Build identity, stamped into the bundle so a reviewer can compare what their browser is running
 * against the version in a shared link. Format: YYYYMMDD-HHMM-<short sha>. The timestamp comes from
 * the build, the sha from the working tree, and a missing git binary degrades to `nogit` rather than
 * failing the build.
 */
const buildId = (): string => {
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('') + '-' + [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
  ].join('')

  let sha: string
  try {
    sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'nogit'
  } catch {
    sha = 'nogit'
  }

  return `${stamp}-${sha}`
}

/**
 * Synthetic demo fixtures are development-only inputs. Vite copies everything under `public/`
 * into the build output, so a built artifact must actively drop them: a published bundle must
 * never ship demo effects or demo geometry.
 */
const pruneSyntheticDevAssets = (): Plugin => ({
  name: 'prune-synthetic-dev-assets',
  apply: 'build',
  async closeBundle() {
    await rm(resolve(process.cwd(), 'dist/data/demo'), { recursive: true, force: true })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production' && env.VITE_USE_DEMO_DATA === 'true') {
    throw new Error('Production builds cannot run with VITE_USE_DEMO_DATA=true.')
  }

  return {
    plugins: [react(), pruneSyntheticDevAssets()],
    define: {
      __BUILD_ID__: JSON.stringify(mode === 'production' ? buildId() : 'dev'),
    },
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
  }
})
