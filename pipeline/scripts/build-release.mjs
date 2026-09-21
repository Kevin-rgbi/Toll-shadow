import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRelease } from '../src/release.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const releaseId = argument('--release-id');
const generatedAt = argument('--generated-at');
if (!releaseId || !generatedAt) {
  console.error('Usage: node pipeline/scripts/build-release.mjs --release-id YYYY-MM-DD.N --generated-at ISO-8601');
  process.exit(1);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '../..');
const workspaceRoot = path.resolve(repositoryRoot, '../..');

buildRelease({
  releaseId,
  generatedAt,
  trafficInput: path.join(workspaceRoot, 'data/raw/traffic/Automated_Traffic_Volume_Counts_20260915 (1).csv'),
  mtaInput: path.join(workspaceRoot, 'data/raw/traffic/Daily_Traffic_on_MTA_Bridges_&_Tunnels_20260915.csv'),
  crzInput: path.join(workspaceRoot, 'data/raw/crz/crz_entries_by_group_month.json'),
  airInput: path.join(workspaceRoot, 'data/derived/air-context/annual_black_carbon_relative.json'),
  healthInput: path.join(workspaceRoot, 'data/derived/health/nyc_asthma_historical.json'),
  equityInput: path.join(workspaceRoot, 'data/derived/equity/nyc_dac_2023_simplified.geojson'),
  catalogPath: path.join(workspaceRoot, 'data/catalog/sources.yaml'),
  methodSpecPath: path.join(repositoryRoot, 'pipeline/methods/release-1.yaml'),
  releaseRoot: path.join(repositoryRoot, 'data/releases'),
  publicDataRoot: path.join(repositoryRoot, 'public/data'),
}).then(({ manifest, quality }) => {
  console.log(`built release ${manifest.release_id}: ${manifest.assets.length} assets; DOT invalid rows recorded: ${quality.source_quality.dot.invalid_rows}`);
}).catch((error) => {
  console.error(`release build failed: ${error.message}`);
  process.exitCode = 1;
});
