import { execSync } from 'node:child_process'
import { copyFile, mkdir, readFile, readdir, rm } from 'node:fs/promises'
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
    const manifest = JSON.parse(await readFile(resolve(process.cwd(), 'dist/data/manifest.json'), 'utf8'))
    const releases = resolve(process.cwd(), 'dist/data/releases')
    for (const entry of await readdir(releases, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== manifest.release_id) await rm(resolve(releases, entry.name), { recursive: true })
    }
  },
})

/**
 * MapLibre GL builds its worker URL at runtime as `./maplibre-gl-worker.mjs`, relative to the bundle
 * chunk. Vite cannot see that URL because the filename is chosen by the library at runtime, so the
 * worker file is never emitted and the request falls through to the SPA shell. The worker then fails
 * to parse, MapLibre's style never finishes loading, and the map hangs on its background layer: a
 * grey map with no basemap and no published points, and no error anywhere.
 *
 * The file has to keep its exact name, next to the chunk, so it is copied verbatim rather than
 * hashed.
 */
const MAPLIBRE_RUNTIME_FILES = [
  'maplibre-gl-worker.mjs',
  'maplibre-gl-shared.mjs',
]

const emitMapLibreWorker = (stamp: string): Plugin => ({
  name: 'emit-maplibre-worker',
  apply: 'build',
  async closeBundle() {
    // A build-stamped directory, not a bare /assets/ path. The worker URL carries no content hash
    // (the library hard-codes the filename and its internal relative import), so a client that
    // cached a 404 for a fixed path would keep failing until that cache expired. A path that changes
    // per build means a bad cache entry can never outlive the build that produced it.
    const targetDir = resolve(process.cwd(), 'dist/assets/maplibre', stamp)
    await mkdir(targetDir, { recursive: true })
    await Promise.all(MAPLIBRE_RUNTIME_FILES.map((file) => copyFile(
      resolve(process.cwd(), 'node_modules/maplibre-gl/dist', file),
      resolve(targetDir, file),
    )))
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production' && env.VITE_USE_DEMO_DATA === 'true') {
    throw new Error('Production builds cannot run with VITE_USE_DEMO_DATA=true.')
  }

  const stamp = mode === 'production' ? buildId() : 'dev'

  return {
    plugins: [react(), pruneSyntheticDevAssets(), emitMapLibreWorker(stamp)],
    test: {
      env: {
        VITE_USE_DEMO_DATA: 'false',
      },
    },
    define: {
      __BUILD_ID__: JSON.stringify(stamp),
      // Empty in development, where the worker resolves from node_modules instead.
      __MAPLIBRE_WORKER_URL__: JSON.stringify(
        mode === 'production' ? `/assets/maplibre/${stamp}/maplibre-gl-worker.mjs` : '',
      ),
    },
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
  }
})
