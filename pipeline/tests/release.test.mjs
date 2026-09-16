import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buildRelease } from '../src/release.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const workspaceRoot = path.resolve(repositoryRoot, '../..');
const fixture = (name) => path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', name);
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('buildRelease', () => {
  it('builds immutable browser-safe DOT and MTA assets with source-quality evidence', async () => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'toll-shadow-release-'));
    temporaryDirectories.push(temporaryRoot);
    const result = await buildRelease({
      releaseId: '2026-09-16.2',
      generatedAt: '2026-09-16T03:30:00.000Z',
      trafficInput: fixture('traffic-valid.csv'),
      mtaInput: fixture('mta-valid.csv'),
      catalogPath: path.join(workspaceRoot, 'data/catalog/sources.yaml'),
      methodSpecPath: path.join(repositoryRoot, 'pipeline/methods/release-1.yaml'),
      releaseRoot: path.join(temporaryRoot, 'releases'),
      publicDataRoot: path.join(temporaryRoot, 'public-data'),
    });
    expect(result.manifest.assets.map((asset) => asset.kind)).toEqual(['traffic_observations', 'facility_crossings']);
    expect(result.quality.source_quality.dot).toMatchObject({ included_rows: 1, invalid_rows: 0 });
    const publicManifest = JSON.parse(await readFile(path.join(temporaryRoot, 'public-data/manifest.json'), 'utf8'));
    expect(publicManifest.policy_reference_date).toBe('2025-01-05');
    await expect(buildRelease({
      releaseId: '2026-09-16.2',
      generatedAt: '2026-09-16T03:30:00.000Z',
      trafficInput: fixture('traffic-valid.csv'),
      mtaInput: fixture('mta-valid.csv'),
      catalogPath: path.join(workspaceRoot, 'data/catalog/sources.yaml'),
      methodSpecPath: path.join(repositoryRoot, 'pipeline/methods/release-1.yaml'),
      releaseRoot: path.join(temporaryRoot, 'releases'),
      publicDataRoot: path.join(temporaryRoot, 'public-data'),
    })).rejects.toThrow();
  });
});
