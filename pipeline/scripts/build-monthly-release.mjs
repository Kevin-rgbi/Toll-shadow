import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readContractCsv } from '../src/csv.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const parent = path.dirname(root);
const releaseId = '2026-09-18.1';
const output = path.join(root, 'public/data/releases', releaseId);
const transform = 'monthly-coverage-1.0.0';
const limitations = [
  'These are observational patterns, not evidence that congestion pricing caused changes or displaced traffic.',
  'DOT counts are sampled historical observations, not continuous citywide traffic measurements.',
  'No causal air-quality claims are supported by this release.',
  'The baseline is 2025 after launch, not a pre-policy counterfactual. The default comparison matches February–August 2025 and 2026, excluding January.',
];
const numeric = new Set(['year', 'month', 'facility_id', 'crz_entries', 'excluded_roadway_entries', 'all_entries', 'coverage_days', 'latitude', 'longitude', 'car_count', 'truck_count', 'bus_count', 'motorcycle_count', 'other_vehicle_count', 'total_traffic', 'avg_daily_crz_entries', 'avg_daily_excluded_entries', 'avg_daily_all_entries', 'same_month_2025_avg_daily_crz', 'pct_change_vs_same_month_2025', 'avg_daily_total_traffic', 'same_month_2025_avg_daily_traffic']);

async function monthly(file, layer) {
  const rows = [];
  const keys = new Set();
  const required = ['month_start', 'year', 'month', 'coverage_days', 'complete_month', 'latitude', 'longitude', 'coordinate_note', 'source', ...(layer === 'crz' ? ['detection_group', 'detection_region', 'time_period', 'crz_entries', 'excluded_roadway_entries', 'all_entries'] : ['facility_id', 'facility_code', 'facility_name', 'source_facility_name', 'direction', 'car_count', 'truck_count', 'bus_count', 'motorcycle_count', 'other_vehicle_count', 'total_traffic'])];
  for await (const raw of readContractCsv(path.join(parent, file), required)) {
    const row = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, numeric.has(key) ? (value === '' ? null : Number(value)) : key === 'complete_month' ? value === 'Yes' : value]));
    for (const key of numeric) {
      if (key in row && row[key] !== null && !Number.isFinite(row[key])) throw new Error(`${file}: invalid ${key}`);
    }
    const days = new Date(Date.UTC(row.year, row.month, 0)).getUTCDate();
    if (![2025, 2026].includes(row.year) || row.month < 1 || row.month > 12 || row.month_start !== `${row.year}-${String(row.month).padStart(2, '0')}-01` || !Number.isInteger(row.coverage_days) || row.coverage_days < 1 || row.coverage_days > days || (row.complete_month && row.coverage_days !== days)) throw new Error(`${file}: invalid coverage`);
    if (row.longitude < -75 || row.longitude > -72 || row.latitude < 40 || row.latitude > 42) throw new Error(`${file}: invalid coordinates`);
    const counts = layer === 'crz' ? ['crz_entries', 'excluded_roadway_entries', 'all_entries'] : ['car_count', 'truck_count', 'bus_count', 'motorcycle_count', 'other_vehicle_count', 'total_traffic'];
    if (counts.some(key => !Number.isSafeInteger(row[key]) || row[key] < 0)) throw new Error(`${file}: invalid totals`);
    if (layer === 'crz' ? row.crz_entries + row.excluded_roadway_entries !== row.all_entries : counts.slice(0, -1).reduce((sum, key) => sum + row[key], 0) !== row.total_traffic) throw new Error(`${file}: inconsistent totals`);
    if (layer === 'crz' && !['Peak', 'Overnight'].includes(row.time_period)) throw new Error(`${file}: invalid period`);
    const key = `${row.month_start}:${row.facility_id ?? row.detection_group}:${row.time_period ?? row.direction}`;
    if (keys.has(key)) throw new Error(`${file}: duplicate ${key}`);
    keys.add(key);
    rows.push(row);
  }
  if (!rows.length) throw new Error(`${file}: empty input`);
  const latestMonth = rows.map(row => row.month_start).sort().at(-1);
  const latestRows = rows.filter(row => row.month_start === latestMonth);
  return { schema_version: '2.0.0', layer, source_file: file, source_sha256: createHash('sha256').update(await readFile(path.join(parent, file))).digest('hex'), latest: { month: latestMonth.slice(0, 7), coverage_days: [...new Set(latestRows.map(row => row.coverage_days))], complete: latestRows.every(row => row.complete_month) }, rows };
}

const exportPath = path.join(parent, 'MAPs for MCH/kepler.gl.json');
const exported = JSON.parse(await readFile(exportPath, 'utf8'));
const geofence = exported.datasets.find(dataset => dataset.data.label.startsWith('MTA_Central_Business_District_Geofence__Beginning_June_2024'))?.data;
if (!geofence || geofence.fields[0]?.name !== 'polygon' || !geofence.allData.length) throw new Error('BLOCKER: supplied official MTA geofence absent; no substitute boundary will be published');
const boundary = { type: 'FeatureCollection', features: geofence.allData.map(([wkt], index) => {
  const match = /^POLYGON\s*\(\((.+)\)\)$/i.exec(wkt);
  if (!match) throw new Error('Unsupported official geofence WKT');
  const rings = match[1].split(/\)\s*,\s*\(/).map(ring => ring.split(',').map(point => point.trim().split(/\s+/).map(Number)));
  for (const ring of rings) {
    if (ring.length < 4 || JSON.stringify(ring[0]) !== JSON.stringify(ring.at(-1)) || ring.some(point => point.length !== 2 || point.some(value => !Number.isFinite(value)) || point[0] < -75 || point[0] > -72 || point[1] < 40 || point[1] > 42)) throw new Error('Invalid official geofence ring');
  }
  return { type: 'Feature', properties: { name: 'MTA Central Business District Geofence', source_file: geofence.label, polygon_index: index + 1 }, geometry: { type: 'Polygon', coordinates: rings } };
}) };
const crz = await monthly('MTA_CRZ_Entries_Kepler_2025_2026.csv', 'crz');
const mta = await monthly('MTA_Bridges_Tunnels_Kepler_2025_2026.csv', 'mta');
const previous = JSON.parse(await readFile(path.join(root, 'public/data/releases/2026-09-16.2/manifest.json'), 'utf8'));
const dot = previous.assets.find(asset => asset.kind === 'traffic_observations');
const dotBytes = await readFile(path.join(root, 'public', dot.path));
if (createHash('sha256').update(dotBytes).digest('hex') !== dot.sha256) throw new Error('Historical DOT checksum mismatch');
await mkdir(output, { recursive: true });
const assets = [];
async function publish(kind, filename, payload, metadata) {
  const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
  await writeFile(path.join(output, filename), bytes);
  assets.push({ kind, path: `/data/releases/${releaseId}/${filename}`, format: filename.endsWith('.geojson') ? 'geojson' : filename.endsWith('.csv') ? 'csv' : 'json', sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, status: 'validated', transform_version: transform, ...metadata });
}
await publish('boundary_zone', 'boundary_zone.geojson', boundary, { geometry_crs: 'EPSG:4326', coverage: { start: '2024-06-01', end: '2026-09-16' }, grain: 'seven supplied official MTA geofence polygons, not an inferred toll boundary', source_ids: ['mta_cbd_geofence_20260916'], limitations: ['Extracted unchanged from the official-named geofence dataset embedded in the supplied Kepler export; archive snapshot, not a claim of boundary changes over time.'] });
for (const [kind, filename, payload] of [['crz_context', 'crz_entries.json', crz], ['facility_crossings', 'facility_crossings.json', mta]]) {
  await publish(kind, filename, payload, { geometry_crs: 'EPSG:4326', coverage: { start: payload.rows[0].month_start, end: `${payload.latest.month}-01` }, grain: payload.layer === 'crz' ? 'calendar month, detection group, Peak or Overnight' : 'calendar month, named MTA facility/plaza, all directions', source_ids: [payload.layer === 'crz' ? 'mta_crz_entries_2025_2026' : 'mta_hourly_crossings_2025_2026'], limitations: [...limitations, `Latest: ${payload.latest.month}, ${payload.latest.coverage_days.join('/')} observed days per row; ${payload.latest.complete ? 'complete' : 'partial'} month. Coverage endpoints are month labels, not exact daily observation dates.`, 'Points are approximate locations supplied in the CSV.', ...(payload.layer === 'mta' ? ['Vehicle classes and all-direction monthly totals are available; Peak/Overnight breakdown is not supplied. RFK plazas remain separate source facilities.'] : ['Peak and Overnight totals share coverage days; daily denominators count each group-month only once.'])] });
}
const { kind: _kind, path: _path, format: _format, sha256: _sha, bytes: _bytes, ...dotMetadata } = dot;
await publish('traffic_observations', 'traffic_observations.geojson', dotBytes, dotMetadata);

const airDailyPath = path.join(root, 'data/reference-legacy/NYCCAS_PM25_Daily_2025_2026_Kepler.csv');
const airHourlyPath = path.join(root, 'data/reference-legacy/NYCCAS_PM25_Hourly_2025_2026_Kepler.csv');
const airDailyBytes = await readFile(airDailyPath);
const airHourlyBytes = await readFile(airHourlyPath);
await publish('air_measurements', 'nyccas_pm25_daily.csv', airDailyBytes, {
  coverage: { start: '2025-01-01', end: '2026-09-17' },
  grain: 'daily site-level PM2.5 mean for 15 monitors; qualifying daily values require at least 18 valid hours',
  source_ids: ['nyccas_pm25_monitor_daily_2025_2026'],
  transform_version: 'supplied-kepler-derivative-1.0.0',
  limitations: [
    'Preliminary NYCCAS PM2.5 monitor measurements',
    'Observed concentrations; not a causal estimate of congestion-pricing effects.',
    'Daily values require at least 18 valid hours; missing and low-coverage records are not coerced to zero.',
    'Monitor coordinates are approximate supplied locations.',
  ],
});
await publish('air_measurements', 'nyccas_pm25_hourly.csv', airHourlyBytes, {
  coverage: { start: '2025-01-01', end: '2026-09-17' },
  grain: 'hourly site-level PM2.5 record for 15 monitors; missing hours remain missing',
  source_ids: ['nyccas_pm25_monitor_hourly_2025_2026'],
  transform_version: 'supplied-kepler-derivative-1.0.0',
  limitations: [
    'Preliminary NYCCAS PM2.5 monitor measurements',
    'Observed concentrations; not a causal estimate of congestion-pricing effects.',
    'Hourly mode loads the larger CSV on demand and never carries a prior reading forward.',
    'Monitor coordinates are approximate supplied locations.',
  ],
});
const manifest = { release_id: releaseId, schema_version: '2.1.0', generated_at: new Date().toISOString(), status: 'validated', transform_version: transform, source_ids: assets.flatMap(asset => asset.source_ids), coverage: { start: '2024-01-01', end: '2026-09-17' }, limitations: [...limitations, 'September 2026 is partial: CRZ has 5 observed days per row and MTA crossings has 1; August is the latest complete comparison month. Monthly assets do not identify all underlying observation dates.', 'Preliminary NYCCAS PM2.5 monitor measurements are observed concentrations, not a causal estimate of congestion-pricing effects.', 'NYCCAS monitor coordinates are approximate supplied locations and the hourly derivative retains missing hours rather than carrying values forward.'], assets, policy_reference_date: '2025-01-05' };
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(root, 'public/data/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ releaseId, assets: assets.map(asset => ({ kind: asset.kind, bytes: asset.bytes })), crz: { rows: crz.rows.length, latest: crz.latest }, mta: { rows: mta.rows.length, latest: mta.latest }, polygons: boundary.features.length, air: { dailyBytes: airDailyBytes.length, hourlyBytes: airHourlyBytes.length } }, null, 2));
