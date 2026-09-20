import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { readContractCsv } from './csv.mjs';
import { epsg2263ToWgs84 } from './geospatial.mjs';
import { loadMeasureSpecification } from './measure-spec.mjs';
import { buildFacilityLookup, facilityFor, normalizeMtaDailyRow, MTA_REQUIRED_COLUMNS } from './mta.mjs';
import { normalizeTrafficRow, TRAFFIC_REQUIRED_COLUMNS } from './traffic.mjs';

const TRANSFORM_VERSION = 'pipeline-release-1.2.0';
const MAX_ASSET_BYTES = 5 * 1024 * 1024;

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isWithinCoverage(isoDate, coverage) {
  return isoDate >= coverage.start && isoDate <= coverage.end;
}

function assertReleaseId(releaseId) {
  if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(releaseId)) {
    throw new Error('release_id must use YYYY-MM-DD.N format');
  }
}

function asNumber(value) {
  return Number(value.toFixed(6));
}

async function loadCatalog(catalogPath) {
  const catalog = parse(await readFile(catalogPath, 'utf8'));
  return new Map(catalog.sources.map((source) => [source.source_id, source]));
}

async function collectTraffic({ filePath, coverage }) {
  const groups = new Map();
  const quality = { total_rows: 0, valid_rows: 0, included_rows: 0, invalid_rows: 0, invalid_examples: [] };
  let rowNumber = 1;
  for await (const row of readContractCsv(filePath, TRAFFIC_REQUIRED_COLUMNS)) {
    rowNumber += 1;
    quality.total_rows += 1;
    try {
      const observation = normalizeTrafficRow(row, rowNumber);
      quality.valid_rows += 1;
      const observedOn = observation.observedAt.slice(0, 10);
      if (!isWithinCoverage(observedOn, coverage)) continue;
      quality.included_rows += 1;
      const month = observedOn.slice(0, 7);
      const key = [
        observation.segmentId,
        observation.borough,
        observation.direction,
        month,
        observation.dayType,
        observation.timeBand,
      ].join('|');
      const group = groups.get(key) ?? {
        segmentId: observation.segmentId,
        borough: observation.borough,
        direction: observation.direction,
        month,
        dayType: observation.dayType,
        timeBand: observation.timeBand,
        sourceGeometry: observation.sourceGeometry,
        sumVolume: 0,
        maxVolume: -Infinity,
        observationCount: 0,
        observedDays: new Set(),
        requestIds: new Set(),
        street: observation.street,
        fromStreet: observation.fromStreet,
        toStreet: observation.toStreet,
      };
      if (group.sourceGeometry.x !== observation.sourceGeometry.x || group.sourceGeometry.y !== observation.sourceGeometry.y) {
        throw new Error(`segment/month group ${key} has inconsistent source geometry`);
      }
      group.sumVolume += observation.volume;
      group.maxVolume = Math.max(group.maxVolume, observation.volume);
      group.observationCount += 1;
      group.observedDays.add(observedOn);
      group.requestIds.add(observation.requestId);
      groups.set(key, group);
    } catch (error) {
      quality.invalid_rows += 1;
      if (quality.invalid_examples.length < 10) quality.invalid_examples.push(error.message);
    }
  }

  const features = [...groups.values()]
    .sort((left, right) => `${left.month}|${left.segmentId}|${left.direction}|${left.dayType}|${left.timeBand}`
      .localeCompare(`${right.month}|${right.segmentId}|${right.direction}|${right.dayType}|${right.timeBand}`))
    .map((group) => {
      const { longitude, latitude } = epsg2263ToWgs84(group.sourceGeometry);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [asNumber(longitude), asNumber(latitude)] },
        properties: {
          source_id: 'dot_automated_traffic_counts_archive_20260915',
          measure_id: 'dot_monthly_sampled_traffic_volume',
          segment_id: group.segmentId,
          borough: group.borough,
          direction: group.direction,
          month: group.month,
          day_type: group.dayType,
          time_band: group.timeBand,
          mean_observed_15_min_volume: asNumber(group.sumVolume / group.observationCount),
          max_observed_15_min_volume: group.maxVolume,
          observation_count: group.observationCount,
          observed_days: group.observedDays.size,
          count_sessions: group.requestIds.size,
          street: group.street,
          from_street: group.fromStreet,
          to_street: group.toStreet,
        },
      };
    });
  return { featureCollection: { type: 'FeatureCollection', features }, quality };
}

async function collectMta({ filePath, coverage, facilityLookup }) {
  const records = [];
  const quality = { total_rows: 0, valid_rows: 0, included_rows: 0, invalid_rows: 0, invalid_examples: [] };
  let rowNumber = 1;
  for await (const row of readContractCsv(filePath, MTA_REQUIRED_COLUMNS)) {
    rowNumber += 1;
    quality.total_rows += 1;
    try {
      const crossing = normalizeMtaDailyRow(row, rowNumber);
      quality.valid_rows += 1;
      if (!isWithinCoverage(crossing.observedOn, coverage)) continue;
      // Resolved after the coverage check so an out-of-window plaza does not fail the build.
      const facility = facilityFor(crossing.plazaId, facilityLookup, rowNumber);
      quality.included_rows += 1;
      records.push({
        source_id: 'mta_daily_bridge_tunnel_traffic_archive_20260915',
        measure_id: 'mta_daily_facility_crossings',
        observed_on: crossing.observedOn,
        plaza_id: crossing.plazaId,
        facility_code: facility.code,
        facility_name: facility.name,
        direction: crossing.direction,
        ezpass_vehicles: crossing.ezpassVehicles,
        vtoll_vehicles: crossing.vtollVehicles,
        total_vehicles: crossing.totalVehicles,
        ezpass_share_pct: crossing.totalVehicles === 0 ? null : asNumber((crossing.ezpassVehicles / crossing.totalVehicles) * 100),
      });
    } catch (error) {
      quality.invalid_rows += 1;
      if (quality.invalid_examples.length < 10) quality.invalid_examples.push(error.message);
    }
  }
  if (quality.invalid_rows > 0) throw new Error(`MTA source has ${quality.invalid_rows} invalid rows: ${quality.invalid_examples.join('; ')}`);
  records.sort((left, right) => `${left.observed_on}|${left.plaza_id}|${left.direction}`.localeCompare(`${right.observed_on}|${right.plaza_id}|${right.direction}`));
  return { records, quality };
}

function assetMetadata({ kind, path: assetPath, format, content, coverage, grain, sourceIds, limitations, geometryCrs = undefined }) {
  const bytes = Buffer.byteLength(content);
  if (bytes > MAX_ASSET_BYTES) throw new Error(`${kind} asset is ${bytes} bytes; Release 1 budget is ${MAX_ASSET_BYTES}`);
  return {
    kind,
    path: assetPath,
    format,
    sha256: sha256(content),
    coverage,
    grain,
    source_ids: sourceIds,
    transform_version: TRANSFORM_VERSION,
    status: 'validated',
    limitations,
    ...(geometryCrs ? { geometry_crs: geometryCrs } : {}),
    bytes,
  };
}

function releaseReadme({ releaseId, manifest, quality }) {
  return `# Toll Shadow Data Release ${releaseId}\n\n` +
    `Generated with transform version \`${manifest.transform_version}\`.\n\n` +
    `## Assets\n\n` + manifest.assets.map((asset) => `- \`${asset.kind}\`: \`${asset.path}\` (${asset.bytes} bytes, SHA-256 \`${asset.sha256}\`)`).join('\n') +
    `\n\n## Quality\n\n` +
    `- DOT rows: ${quality.dot.total_rows} inspected; ${quality.dot.included_rows} included; ${quality.dot.invalid_rows} rejected source rows recorded.\n` +
    `- MTA rows: ${quality.mta.total_rows} inspected; ${quality.mta.included_rows} included; ${quality.mta.invalid_rows} rejected source rows.\n` +
    `\n## Claim boundary\n\nThis release contains descriptive sampled traffic and daily crossing records only. It does not provide a causal policy estimate, current air-quality outcome, or health outcome.\n`;
}

export async function buildRelease({
  releaseId,
  generatedAt,
  trafficInput,
  mtaInput,
  catalogPath,
  methodSpecPath,
  releaseRoot,
  publicDataRoot,
}) {
  assertReleaseId(releaseId);
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('generated_at must be a parseable timestamp');
  const specification = await loadMeasureSpecification(methodSpecPath);
  if (specification.release_id !== releaseId) throw new Error(`release_id ${releaseId} does not match measure specification ${specification.release_id}`);
  const catalog = await loadCatalog(catalogPath);
  const [trafficMeasure, mtaMeasure] = specification.measures;
  for (const sourceId of [...trafficMeasure.source_ids, ...mtaMeasure.source_ids]) {
    if (catalog.get(sourceId)?.approval_status !== 'approved_for_pipeline') {
      throw new Error(`${sourceId} is not approved_for_pipeline`);
    }
  }

  const canonicalReleaseDirectory = path.join(releaseRoot, releaseId);
  const publicReleaseDirectory = path.join(publicDataRoot, 'releases', releaseId);
  await mkdir(releaseRoot, { recursive: true });
  await mkdir(path.join(publicDataRoot, 'releases'), { recursive: true });
  await mkdir(canonicalReleaseDirectory, { recursive: false });
  try {
    await mkdir(publicReleaseDirectory, { recursive: false });
    const [traffic, mta] = await Promise.all([
      collectTraffic({ filePath: trafficInput, coverage: trafficMeasure.coverage }),
      collectMta({
        filePath: mtaInput,
        coverage: mtaMeasure.coverage,
        facilityLookup: buildFacilityLookup(catalog.get('mta_daily_bridge_tunnel_traffic_archive_20260915')),
      }),
    ]);
    const trafficContent = serializeJson(traffic.featureCollection);
    const mtaContent = serializeJson({ records: mta.records });
    const trafficAsset = assetMetadata({
      kind: trafficMeasure.asset_kind,
      path: `/data/releases/${releaseId}/traffic_observations.geojson`,
      format: 'geojson',
      content: trafficContent,
      coverage: trafficMeasure.coverage,
      grain: trafficMeasure.grain,
      sourceIds: trafficMeasure.source_ids,
      limitations: trafficMeasure.limitations,
      geometryCrs: 'EPSG:4326',
    });
    const mtaAsset = assetMetadata({
      kind: mtaMeasure.asset_kind,
      path: `/data/releases/${releaseId}/facility_crossings.json`,
      format: 'json',
      content: mtaContent,
      coverage: mtaMeasure.coverage,
      grain: mtaMeasure.grain,
      sourceIds: mtaMeasure.source_ids,
      limitations: mtaMeasure.limitations,
    });
    const manifest = {
      release_id: releaseId,
      // 1.1.0: additive. The traffic asset gained day_type and time_band dimensions; no field was
      // renamed, retyped, or given a new meaning.
      schema_version: '1.2.0',
      generated_at: generatedAt,
      status: 'validated',
      transform_version: TRANSFORM_VERSION,
      source_ids: [...new Set([...trafficMeasure.source_ids, ...mtaMeasure.source_ids])],
      coverage: trafficMeasure.coverage,
      limitations: [
        'Release 1 is descriptive only and does not estimate a causal congestion-pricing effect.',
        'Historical air-quality, asthma, DAC, CRZ-summary, and CBD-derivative assets are excluded pending their separate gates.',
      ],
      assets: [trafficAsset, mtaAsset],
      policy_reference_date: specification.policy_reference.date,
    };
    const quality = {
      release_id: releaseId,
      status: 'validated',
      source_quality: { dot: traffic.quality, mta: mta.quality },
      asset_budget_bytes: MAX_ASSET_BYTES,
      assets: [trafficAsset, mtaAsset].map(({ kind, bytes, sha256: digest }) => ({ kind, bytes, sha256: digest })),
    };
    const files = new Map([
      ['traffic_observations.geojson', trafficContent],
      ['facility_crossings.json', mtaContent],
      ['manifest.json', serializeJson(manifest)],
      ['quality.json', serializeJson(quality)],
      ['README.md', releaseReadme({ releaseId, manifest, quality: { dot: traffic.quality, mta: mta.quality } })],
    ]);
    await Promise.all([...files].map(([file, content]) => writeFile(path.join(canonicalReleaseDirectory, file), content)));
    await Promise.all([...files].filter(([file]) => file !== 'quality.json' && file !== 'README.md').map(([file, content]) => writeFile(path.join(publicReleaseDirectory, file), content)));
    await writeFile(path.join(publicDataRoot, 'manifest.json'), files.get('manifest.json'));
    return { manifest, quality, canonicalReleaseDirectory, publicReleaseDirectory };
  } catch (error) {
    throw error;
  }
}
