#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildConfidenceHotspotsRelease } from '../src/confidence-release.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const result = await buildConfidenceHotspotsRelease({
  previousDirectory: path.join(root, 'data/releases/2026-09-21.1'),
  sourceDirectory: path.join(root, 'data/source-snapshots/2026-09-22'),
  methodSpecPath: path.join(root, 'pipeline/methods/confidence-hotspots-2026-09-22.yaml'),
  deriveScriptPath: path.join(root, 'pipeline/scripts/derive-nyccas-quality.py'),
  releaseRoot: path.join(root, 'data/releases'),
  publicDataRoot: path.join(root, 'public/data'),
  pythonExecutable: process.env.PYTHON ?? 'python3',
});

console.log(JSON.stringify({
  release_id: result.manifest.release_id,
  retained_assets: result.quality.source_quality.retained_assets_with_verified_checksums,
  new_assets: 2,
  westchester_square_historical_sites: result.quality.source_quality.westchester_square.historical_sites_inside,
  westchester_square_current_monitors: result.quality.source_quality.westchester_square.current_monitors_inside,
}, null, 2));
