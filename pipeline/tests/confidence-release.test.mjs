import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildConfidenceHotspotsRelease } from '../src/confidence-release.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '../..');
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('confidence and hotspots release', () => {
  it('retains every prior asset and adds validated quality and neighborhood assets', async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'toll-shadow-confidence-release-'));
    temporaryDirectories.push(temporaryRoot);
    const previousDirectory = path.join(repositoryRoot, 'data/releases/2026-09-21.1');
    const previousManifest = JSON.parse(await readFile(path.join(previousDirectory, 'manifest.json'), 'utf8'));

    const result = await buildConfidenceHotspotsRelease({
      previousDirectory,
      sourceDirectory: path.join(repositoryRoot, 'data/source-snapshots/2026-09-22'),
      methodSpecPath: path.join(repositoryRoot, 'pipeline/methods/confidence-hotspots-2026-09-22.yaml'),
      deriveScriptPath: path.join(repositoryRoot, 'pipeline/scripts/derive-nyccas-quality.py'),
      releaseRoot: path.join(temporaryRoot, 'releases'),
      publicDataRoot: path.join(temporaryRoot, 'public-data'),
      pythonExecutable: process.env.PYTHON ?? 'python3',
    });

    expect(result.manifest.release_id).toBe('2026-09-22.1');
    expect(result.manifest.assets).toHaveLength(10);
    expect(result.manifest.coverage).toEqual(previousManifest.coverage);
    expect(result.manifest.assets.slice(0, 8).map(({ kind, sha256 }) => ({ kind, sha256 })))
      .toEqual(previousManifest.assets.map(({ kind, sha256 }) => ({ kind, sha256 })));
    expect(result.manifest.assets.slice(0, 8).every((asset) => asset.path.includes('/2026-09-22.1/'))).toBe(true);
    expect(result.manifest.assets.slice(8).map((asset) => asset.kind)).toEqual([
      'air_quality_context', 'neighborhood_context',
    ]);
    expect(result.quality.source_quality.workbook_rows).toEqual({ EC: 7491, NOX: 7757, PM: 7555, O3: 1970 });
    expect(result.quality.source_quality.westchester_square).toEqual({
      historical_sites_inside: 0,
      current_monitors_inside: 0,
    });

    const publicManifest = JSON.parse(await readFile(path.join(temporaryRoot, 'public-data/manifest.json'), 'utf8'));
    expect(publicManifest).toEqual(result.manifest);
  }, 20_000);
});
