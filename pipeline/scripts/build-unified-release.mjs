import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { normalizeCrzAggregateRows } from '../src/crz.mjs';
import { normalizeHourlyCrossingAggregates } from '../src/mta-hourly.mjs';
import { collectTraffic } from '../src/release.mjs';

const run = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const releaseId = '2026-09-21.1';
const transformVersion = 'unified-air-traffic-2.0.0';
const generatedAt = '2026-09-21T21:00:00.000Z';
const snapshotRoot = path.join(root, 'data/source-snapshots/2026-09-21');
const previousRelease = path.join(root, 'data/releases/2026-09-20.5');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

const airArchive = argument('--air-archive');
const dotInput = argument('--dot-input');
if (!airArchive || !dotInput) {
  console.error('Usage: node pipeline/scripts/build-unified-release.mjs --air-archive /path/to/nyccas.zip --dot-input /path/to/dot.csv');
  process.exit(1);
}

const canonicalDirectory = path.join(root, 'data/releases', releaseId);
const publicDirectory = path.join(root, 'public/data/releases', releaseId);
const temporaryDirectory = await mkdir(path.join(os.tmpdir(), `toll-shadow-${releaseId}-`), { recursive: false }).catch(async (error) => {
  if (error.code !== 'EEXIST') throw error;
  return path.join(os.tmpdir(), `toll-shadow-${releaseId}-${process.pid}`);
});
const temp = typeof temporaryDirectory === 'string' ? temporaryDirectory : path.join(os.tmpdir(), `toll-shadow-${releaseId}-`);

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const json = (value, pretty = false) => `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`;
const limitations = {
  common: 'Descriptive observations only; this release does not estimate a causal congestion-pricing effect.',
  air: 'Preliminary NYCCAS PM2.5 monitor measurements; not a regulatory determination or causal health estimate.',
};
const urls = {
  dot: 'https://data.cityofnewyork.us/Transportation/Automated-Traffic-Volume-Counts/7ym2-wayt/about_data',
  crossings: 'https://data.ny.gov/Transportation/MTA-Bridges-and-Tunnels-Hourly-Crossings-Beginning/ebfx-2m7v/about_data',
  crz: 'https://data.ny.gov/Transportation/MTA-Congestion-Relief-Zone-Vehicle-Entries-Beginni/t6yz-b64h/about_data',
  air: 'https://github.com/nychealth/nyccas-data',
};

let canonicalCreated = false;
let publicCreated = false;
try {
  await mkdir(temp, { recursive: true });
  const dailyPath = path.join(temp, 'nyccas_pm25_daily.csv');
  const hourlyPath = path.join(temp, 'nyccas_pm25_hourly.csv');
  const airQualityPath = path.join(temp, 'air-quality.json');
  await run('python3', [path.join(root, 'pipeline/scripts/derive-air-measurements.py'), '--archive', airArchive, '--daily-out', dailyPath, '--hourly-out', hourlyPath, '--quality-out', airQualityPath], { maxBuffer: 1024 * 1024 });

  const [traffic, crzRows, crossingRows, retrieval, previousManifest] = await Promise.all([
    collectTraffic({ filePath: dotInput, coverage: { start: '2024-01-01', end: '2026-02-03' } }),
    readFile(path.join(snapshotRoot, 'crz_by_group_month.json'), 'utf8').then(JSON.parse),
    readFile(path.join(snapshotRoot, 'crossings_by_day_facility_direction_payment.json'), 'utf8').then(JSON.parse),
    readFile(path.join(snapshotRoot, 'retrieval.json'), 'utf8').then(JSON.parse),
    readFile(path.join(previousRelease, 'manifest.json'), 'utf8').then(JSON.parse),
  ]);
  const crz = normalizeCrzAggregateRows(crzRows).map((row) => ({
    source_id: 'mta_crz_entries_archive_20260921',
    measure_id: 'crz_monthly_detection_group_entries',
    detection_group: row.detectionGroup,
    detection_region: row.detectionRegion,
    month: row.month,
    crz_entries: row.crzEntries,
    excluded_roadway_entries: row.excludedRoadwayEntries,
    total_entries: row.crzEntries + row.excludedRoadwayEntries,
  }));
  const crossings = normalizeHourlyCrossingAggregates(crossingRows);
  const airQuality = JSON.parse(await readFile(airQualityPath, 'utf8'));

  await mkdir(canonicalDirectory, { recursive: false });
  canonicalCreated = true;
  await mkdir(publicDirectory, { recursive: false });
  publicCreated = true;
  const assets = [];
  async function publish({ kind, filename, content, coverage, grain, sourceIds, sourceUrls, assetLimitations, format = 'json', geometryCrs, assetTransform = transformVersion }) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    await Promise.all([writeFile(path.join(canonicalDirectory, filename), bytes), writeFile(path.join(publicDirectory, filename), bytes)]);
    assets.push({
      kind, path: `/data/releases/${releaseId}/${filename}`, format, sha256: sha256(bytes), bytes: bytes.length,
      coverage, grain, source_ids: sourceIds, source_urls: sourceUrls, transform_version: assetTransform,
      status: 'validated', limitations: assetLimitations, ...(geometryCrs ? { geometry_crs: geometryCrs } : {}),
    });
  }

  await publish({
    kind: 'traffic_observations', filename: 'traffic_observations.geojson', content: json(traffic.featureCollection), format: 'geojson', geometryCrs: 'EPSG:4326',
    coverage: { start: '2024-01-01', end: '2026-02-03' },
    grain: 'one segment, borough, direction, calendar-month, day-type, and time-band aggregate of sampled 15-minute DOT observations',
    sourceIds: ['dot_automated_traffic_counts_archive_20260915'], sourceUrls: [urls.dot],
    assetLimitations: [limitations.common, 'DOT counts are sampled observations, not continuous citywide traffic measurements; absent combinations are omitted rather than zero-filled.'],
  });
  await publish({
    kind: 'facility_crossings', filename: 'facility_crossings.json', content: json({ records: crossings.records }),
    coverage: { start: '2025-01-01', end: '2026-09-08' },
    grain: 'one calendar-day, official facility ID and name, full source direction, with E-ZPass and Tolls by Mail components aggregated from hourly records',
    sourceIds: ['mta_hourly_crossings_archive_20260921'], sourceUrls: [urls.crossings],
    assetLimitations: [limitations.common, 'Facility crossings are separate from CRZ entries and are not added to them.', 'One source group on 2026-07-25 has no Tolls by Mail aggregate; that component remains null.'],
  });
  await publish({
    kind: 'crz_context', filename: 'crz_entry_summary.json', content: json({ records: crz }),
    coverage: { start: '2025-01-05', end: '2026-09-12' },
    grain: 'one calendar-month aggregate per CRZ detection group, preserving CRZ and excluded-roadway entries separately',
    sourceIds: ['mta_crz_entries_archive_20260921'], sourceUrls: [urls.crz],
    assetLimitations: [limitations.common, 'Counts are vehicle entries, not revenue or unique vehicles.', 'Detection groups are areas; no unverified point coordinates are published.'],
  });
  await publish({
    kind: 'air_measurements', filename: 'nyccas_pm25_daily.csv', content: await readFile(dailyPath), format: 'csv', geometryCrs: 'EPSG:4326',
    coverage: { start: '2024-12-31', end: '2026-09-20' },
    grain: 'one active monitor and America/New_York calendar day; values require 75% of expected 23, 24, or 25 local-day hours',
    sourceIds: ['nyccas_pm25_archive_20260921'], sourceUrls: [urls.air],
    assetLimitations: [limitations.air, 'UTC timestamps are retained; daily dates use America/New_York and account for DST.', 'Missing and low-coverage values are null, never zero; relocation-day means are withheld.'],
  });
  await publish({
    kind: 'air_measurements', filename: 'nyccas_pm25_hourly.csv', content: await readFile(hourlyPath), format: 'csv', geometryCrs: 'EPSG:4326',
    coverage: { start: '2025-01-01', end: '2026-09-21' },
    grain: 'one active monitor and UTC hour, including explicit null rows for missing observations and timestamped official location history',
    sourceIds: ['nyccas_pm25_archive_20260921'], sourceUrls: [urls.air],
    assetLimitations: [limitations.air, 'Hourly data loads on demand and never carries a prior observation forward.', 'Midtown West coordinates follow the official timestamped location history.'],
  });

  for (const [kind, filename] of [['historical_context', 'air_context.json'], ['health_context', 'health_context.json'], ['dac_context', 'equity_context.geojson']]) {
    const previous = previousManifest.assets.find((asset) => asset.kind === kind);
    const content = await readFile(path.join(previousRelease, filename));
    if (sha256(content) !== previous.sha256) throw new Error(`previous ${kind} checksum mismatch`);
    await publish({
      kind, filename, content, format: previous.format, geometryCrs: previous.geometry_crs,
      coverage: previous.coverage, grain: previous.grain, sourceIds: previous.source_ids,
      sourceUrls: previous.source_urls, assetLimitations: previous.limitations, assetTransform: previous.transform_version,
    });
  }

  const manifest = {
    release_id: releaseId, schema_version: '2.1.0', generated_at: generatedAt, status: 'validated', transform_version: transformVersion,
    source_ids: [...new Set(assets.flatMap((asset) => asset.source_ids))], coverage: { start: '2024-01-01', end: '2026-09-21' },
    limitations: [limitations.common, limitations.air, 'Traffic, crossings, CRZ, measured air, historical air, health, and equity retain their own grains and are never combined into one inferred measure.'],
    assets, policy_reference_date: '2025-01-05',
  };
  const quality = {
    release_id: releaseId, status: 'validated',
    source_quality: {
      dot: traffic.quality,
      crz: { raw_source: retrieval.source_counts.crz, aggregate_rows: crzRows.length },
      crossings: { raw_source: retrieval.source_counts.crossings_2025_2026, ...crossings.quality },
      air: airQuality,
      context_assets_reused_with_verified_checksums: 3,
    },
    assets: assets.map(({ kind, path: assetPath, bytes, sha256: digest }) => ({ kind, path: assetPath, bytes, sha256: digest })),
  };
  const readme = `# Toll Shadow Data Release ${releaseId}\n\nThis immutable release integrates official 2025-2026 measured air and traffic data. It is descriptive and non-causal.\n\n## Rebuild\n\n\`\`\`sh\nnode pipeline/scripts/fetch-official-traffic-snapshots.mjs\nnode pipeline/scripts/build-unified-release.mjs --air-archive /path/to/nyccas-data-main.zip --dot-input /path/to/Automated_Traffic_Volume_Counts_20260921.csv\n\`\`\`\n\nNYCCAS archive SHA-256: \`c51fd1127ac71d23125c0e19a368de1747f7564d321ba8066e59becdfed76e04\`. DOT snapshot SHA-256: \`14d10d768c0398ebec41642c8b8deec2540c6165afb6f8f1a6231349b3619744\`.\n\nSee \`quality.json\` and the manifest for exact coverage, grain, source URLs, row counts, checksums, and limitations.\n`;
  const manifestContent = json(manifest, true);
  await Promise.all([
    writeFile(path.join(canonicalDirectory, 'manifest.json'), manifestContent),
    writeFile(path.join(publicDirectory, 'manifest.json'), manifestContent),
    writeFile(path.join(root, 'public/data/manifest.json'), manifestContent),
    writeFile(path.join(canonicalDirectory, 'quality.json'), json(quality, true)),
    writeFile(path.join(canonicalDirectory, 'README.md'), readme),
  ]);
  console.log(JSON.stringify({ release_id: releaseId, assets: assets.map(({ kind, bytes }) => ({ kind, bytes })), quality: quality.source_quality }, null, 2));
} catch (error) {
  if (canonicalCreated) await rm(canonicalDirectory, { recursive: true, force: true });
  if (publicCreated) await rm(publicDirectory, { recursive: true, force: true });
  throw error;
} finally {
  await rm(temp, { recursive: true, force: true });
}
