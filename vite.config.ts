import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
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
const releaseIdForIndex = (): string => {
  const spec = readFileSync(resolve(process.cwd(), 'pipeline/methods/unified-release-2026-09-21.yaml'), 'utf8')
  const match = /^release_id:\s*(\S+)/m.exec(spec)
  if (!match) throw new Error('the unified release method declares no release_id')
  return match[1]
}

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
  // The worker imports this one, so copying only the worker produces a worker that parses, fails its
  // import, and dies. The chain ends here: this file imports nothing relative.
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


/**
 * Crawler-facing structured data is generated from the release the build actually ships.
 *
 * It used to be hand-written in `index.html`, and it went stale exactly as hand-written metadata does:
 * it named a superseded release and advertised two distribution URLs that had since been removed, so a
 * crawler following them got 404s while the page described only part of the release. Generating it from the
 * published manifest removes the drift, and the deployment gate asserts the result matches the manifest.
 */
const KIND_MEASURES: Record<string, string> = {
  traffic_observations: 'Mean observed 15-minute traffic volume, by segment and period',
  facility_crossings: 'Daily E-ZPass and Tolls by Mail vehicles, by MTA facility and full direction',
  crz_context: 'Monthly CRZ vehicle entries, by detection group',
  historical_context: 'Modelled historical air surface, published as a relative field',
  health_context: 'Historical asthma hospitalisations and ED visits, by borough',
  dac_context: 'Archived 2023 disadvantaged-communities criteria, by census tract',
  air_measurements: 'Preliminary NYCCAS hourly and New York local-day PM2.5 monitor measurements',
};

const injectDatasetJsonLd = (releaseId: string): Plugin => {
  const readManifest = (): { release_id: string, coverage: { start: string, end: string }, source_urls?: string[], assets: Array<{ kind: string, path: string, format: string, source_urls: string[] }> } =>
    JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/manifest.json'), 'utf8'));

  return {
    name: 'toll-shadow-dataset-jsonld',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const manifest = readManifest();
        if (manifest.release_id !== releaseId) {
          throw new Error(`index.html would describe ${releaseId} but the published manifest is ${manifest.release_id}`);
        }
        const origin = 'https://tollshallows.web.app';
        const dataset = {
          '@type': 'Dataset',
          '@id': `${origin}/#dataset`,
          name: `Toll Shadow Release ${manifest.release_id}`,
          description:
            `Descriptive observations published as ${manifest.assets.length} verified assets, covering `
            + `${manifest.coverage.start} through ${manifest.coverage.end}. `
            + 'No causal or counterfactual estimate is published.',
          url: `${origin}/`,
          isAccessibleForFree: true,
          creator: { '@type': 'Organization', name: 'The Toll Shadow project' },
          temporalCoverage: `${manifest.coverage.start}/${manifest.coverage.end}`,
          spatialCoverage: {
            '@type': 'Place',
            name: 'New York City',
            geo: { '@type': 'GeoShape', box: '40.45 -74.35 40.98 -73.55' },
          },
          variableMeasured: manifest.assets.map((asset) => KIND_MEASURES[asset.kind] ?? asset.kind),
          isBasedOn: [...new Set(manifest.assets.flatMap((asset) => asset.source_urls))],
          distribution: manifest.assets.map((asset) => ({
            '@type': 'DataDownload',
            name: asset.kind,
            encodingFormat: asset.format === 'geojson' ? 'application/geo+json' : 'application/json',
            contentUrl: `${origin}${asset.path}`,
          })),
        }
        const noscriptItems = manifest.assets.map((asset) => {
          const label = (KIND_MEASURES[asset.kind] ?? asset.kind).split(',')[0]
          return `          <li>\n            <a href="${asset.path}">${label}</a>: published as <code>${asset.kind}</code>.\n          </li>`
        }).join('\n')
        const withAssets = html.replace(
          /(<ul style="margin:0 0 16px;padding-left:20px">\n)([\s\S]*?)( {8}<\/ul>)/,
          (_match, open, _body, close) =>
            `${open}          <li>\n            <a href="/data/manifest.json">Release manifest</a>: release ID, coverage window, asset\n            checksums, sources, and limitations.\n          </li>\n${noscriptItems}\n          <li>\n            <a href="https://github.com/Kevin-rgbi/Toll-shadow">Source code and methodology</a>.\n          </li>\n${close}`,
        )

        return withAssets.replace(
          /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
          `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [
            {
              '@type': 'WebSite',
              '@id': `${origin}/#website`,
              url: `${origin}/`,
              name: 'Toll Shadow',
              inLanguage: 'en',
              description: 'A public explorer for New York City traffic observations around the Congestion Relief Zone.',
            },
            dataset,
          ] })}</script>`,
        )
      },
    },
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production' && env.VITE_USE_DEMO_DATA === 'true') {
    throw new Error('Production builds cannot run with VITE_USE_DEMO_DATA=true.')
  }

  const stamp = mode === 'production' ? buildId() : 'dev'

  return {
    plugins: [react(), pruneSyntheticDevAssets(), emitMapLibreWorker(stamp), injectDatasetJsonLd(releaseIdForIndex())],
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
