import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

/**
 * The published manifest has to match the contract that describes it.
 *
 * `data/contracts/release-manifest.yaml` declared an `allowed_asset_kinds` list that nothing read, and
 * it had drifted: the health context asset was published while the list that is supposed to permit it
 * omitted it. A declaration nothing enforces is documentation, not a contract, so this reads both and
 * compares them, which is also what forces a new asset kind to be declared before it can ship.
 */

const repoRoot = path.resolve(import.meta.dirname, '../..');
const contract = parse(readFileSync(path.join(repoRoot, 'data/contracts/release-manifest.yaml'), 'utf8'));
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'public/data/manifest.json'), 'utf8'));
const contractFiles = readdirSync(path.join(repoRoot, 'data/contracts')).filter((f) => f.endsWith('.yaml'));

describe('release manifest contract', () => {
  it('declares every asset kind the published release carries', () => {
    const published = manifest.assets.map((asset) => asset.kind);
    const undeclared = published.filter((kind) => !contract.allowed_asset_kinds.includes(kind));
    expect(undeclared, 'these kinds ship without appearing in allowed_asset_kinds').toEqual([]);
  });

  it('carries every required field on the manifest and on each asset', () => {
    const missingTop = contract.required_fields.filter((field) => !(field in manifest));
    expect(missingTop, 'the manifest is missing required fields').toEqual([]);

    for (const asset of manifest.assets) {
      const missing = contract.asset_required_fields.filter((field) => !(field in asset));
      expect(missing, `${asset.kind} is missing required fields`).toEqual([]);
    }
  });

  it('publishes a source URL for every asset, as the contract now requires', () => {
    for (const asset of manifest.assets) {
      expect(Array.isArray(asset.source_urls) && asset.source_urls.length > 0, `${asset.kind} has no source URL`).toBe(true);
      for (const url of asset.source_urls) {
        expect(url, `${asset.kind} source URL is not absolute http(s)`).toMatch(/^https?:\/\//);
      }
    }
  });

  it('keeps a contract file for every published asset kind', () => {
    // Each contract names the kinds it covers in its own file; every published kind must be covered
    // by one of them, so a new domain cannot ship with no written contract at all.
    const covered = new Set();
    for (const file of contractFiles) {
      if (file === 'release-manifest.yaml') continue;
      const doc = parse(readFileSync(path.join(repoRoot, 'data/contracts', file), 'utf8'));
      for (const kind of doc.covers_asset_kinds ?? []) covered.add(kind);
    }

    const uncovered = manifest.assets
      .map((asset) => asset.kind)
      .filter((kind) => !covered.has(kind) && !hasOwnContract(kind));

    expect(uncovered, 'these published kinds have no domain contract').toEqual([]);
  });
});

/** A domain contract may identify its asset by id rather than by listing kinds. */
function hasOwnContract(kind) {
  const idByKind = {
    traffic_observations: 'traffic-observation',
    facility_crossings: 'mta-daily-crossing',
    crz_context: 'crz-entry-summary',
    historical_context: 'nyccas-air-context-relative',
    health_context: 'nys-asthma-historical-context',
    dac_context: 'archived-dac-context-2023',
  };
  const wanted = idByKind[kind];
  if (!wanted) return false;
  return contractFiles.some((file) => {
    const doc = parse(readFileSync(path.join(repoRoot, 'data/contracts', file), 'utf8'));
    return doc.contract_id === wanted;
  });
}
