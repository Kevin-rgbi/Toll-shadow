import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { loadMeasureSpecification } from './measure-spec.mjs';

const run = promisify(execFile);
const RELEASE_ID = '2026-09-22.1';
const TRANSFORM_VERSION = 'quality-hotspots-1.0.0';
const EXPECTED_ROWS = { EC: 7491, NOX: 7757, PM: 7555, O3: 1970 };
const NYCCAS_URL = 'https://a816-dohbesp.nyc.gov/IndicatorPublic/data-explorer/air-quality/?id=2023#display=summary';
const NTA_URL = 'https://data.cityofnewyork.us/City-Government/2020-Neighborhood-Tabulation-Areas-NTAs-/9nt8-h7nd/about_data';

const sha256 = (content) => createHash('sha256').update(content).digest('hex');
const json = (value, pretty = false) => `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`;

async function verifiedRead(filePath, expectedSha, label) {
  const content = await readFile(filePath);
  const actual = sha256(content);
  if (actual !== expectedSha) throw new Error(`${label} checksum mismatch: expected ${expectedSha}, got ${actual}`);
  return content;
}

export async function buildConfidenceHotspotsRelease({
  previousDirectory,
  sourceDirectory,
  methodSpecPath,
  deriveScriptPath,
  releaseRoot,
  publicDataRoot,
  pythonExecutable = 'python3',
  generatedAt = '2026-09-22T20:00:00.000Z',
}) {
  const previousManifest = JSON.parse(await readFile(path.join(previousDirectory, 'manifest.json'), 'utf8'));
  if (previousManifest.release_id !== '2026-09-21.1' || previousManifest.status !== 'validated' || previousManifest.assets.length !== 8) {
    throw new Error('previous release must be validated 2026-09-21.1 with eight asset entries');
  }
  const method = await loadMeasureSpecification(methodSpecPath);
  const measureIds = new Set(method.measures.map((measure) => measure.measure_id));
  for (const required of ['nyccas_source_quality_coverage', 'westchester_square_monitor_coverage', 'dot_observed_segment_ranking']) {
    if (!measureIds.has(required)) throw new Error(`approved measure specification is missing ${required}`);
  }

  const dailyAsset = previousManifest.assets.find((asset) => asset.kind === 'air_measurements' && asset.path.endsWith('/nyccas_pm25_daily.csv'));
  if (!dailyAsset) throw new Error('previous release does not declare the current daily-air asset');
  const currentAirPath = path.join(previousDirectory, path.basename(dailyAsset.path));
  await verifiedRead(currentAirPath, dailyAsset.sha256, 'current daily-air asset');

  const releaseDirectory = path.join(releaseRoot, RELEASE_ID);
  const publicReleaseDirectory = path.join(publicDataRoot, 'releases', RELEASE_ID);
  const temp = await mkdtemp(path.join(os.tmpdir(), `toll-shadow-${RELEASE_ID}-`));
  let canonicalCreated = false;
  let publicCreated = false;

  try {
    const qualityPath = path.join(temp, 'air_quality_context.json');
    const neighborhoodPath = path.join(temp, 'neighborhood_context.geojson');
    await run(pythonExecutable, [
      deriveScriptPath,
      '--ec', path.join(sourceDirectory, 'EC_raw_data_year1_17.xlsx'),
      '--nox', path.join(sourceDirectory, 'NOX_raw_data_year1_17.xlsx'),
      '--pm', path.join(sourceDirectory, 'PM_raw_data_year1_17.xlsx'),
      '--o3', path.join(sourceDirectory, 'O3_raw_data_year1_17.xlsx'),
      '--nta', path.join(sourceDirectory, 'westchester_square_nta.geojson'),
      '--current-air', currentAirPath,
      '--quality-out', qualityPath,
      '--neighborhood-out', neighborhoodPath,
    ], { maxBuffer: 1024 * 1024 });

    const qualityContent = await readFile(qualityPath);
    const neighborhoodContent = await readFile(neighborhoodPath);
    const qualityContext = JSON.parse(qualityContent);
    const neighborhoodContext = JSON.parse(neighborhoodContent);
    const workbookRows = Object.fromEntries(Object.entries(qualityContext.pollutants).map(([key, value]) => [key, value.source_rows]));
    if (JSON.stringify(workbookRows) !== JSON.stringify(EXPECTED_ROWS)) {
      throw new Error(`unexpected workbook row counts: ${JSON.stringify(workbookRows)}`);
    }
    const westchester = neighborhoodContext.coverage_summary;
    if (westchester.historical_sites_inside !== 0 || westchester.current_monitors_inside !== 0) {
      throw new Error(`Westchester Square zero-site invariant changed: ${JSON.stringify(westchester)}`);
    }

    await mkdir(releaseRoot, { recursive: true });
    await mkdir(path.join(publicDataRoot, 'releases'), { recursive: true });
    await mkdir(releaseDirectory, { recursive: false });
    canonicalCreated = true;
    await mkdir(publicReleaseDirectory, { recursive: false });
    publicCreated = true;

    const assets = [];
    for (const previousAsset of previousManifest.assets) {
      const filename = path.basename(previousAsset.path);
      const content = await verifiedRead(path.join(previousDirectory, filename), previousAsset.sha256, `retained ${previousAsset.kind} asset ${filename}`);
      await Promise.all([
        writeFile(path.join(releaseDirectory, filename), content),
        writeFile(path.join(publicReleaseDirectory, filename), content),
      ]);
      assets.push({ ...previousAsset, path: `/data/releases/${RELEASE_ID}/${filename}` });
    }

    async function publish(kind, filename, content, details) {
      await Promise.all([
        writeFile(path.join(releaseDirectory, filename), content),
        writeFile(path.join(publicReleaseDirectory, filename), content),
      ]);
      assets.push({
        kind,
        path: `/data/releases/${RELEASE_ID}/${filename}`,
        format: details.format,
        sha256: sha256(content),
        bytes: content.length,
        coverage: details.coverage,
        grain: details.grain,
        source_ids: details.sourceIds,
        source_urls: details.sourceUrls,
        transform_version: TRANSFORM_VERSION,
        status: 'validated',
        limitations: details.limitations,
        ...(details.geometryCrs ? { geometry_crs: details.geometryCrs } : {}),
      });
    }

    const workbookSourceIds = [
      'nyccas_ec_year1_17_20260810',
      'nyccas_nox_year1_17_20260810',
      'nyccas_pm_year1_17_20260810',
      'nyccas_o3_year1_17_20260810',
    ];
    await publish('air_quality_context', 'air_quality_context.json', qualityContent, {
      format: 'json',
      coverage: qualityContext.coverage,
      grain: 'one workbook-level pollutant summary plus one site/post coverage summary',
      sourceIds: workbookSourceIds,
      sourceUrls: [NYCCAS_URL],
      limitations: qualityContext.limitations,
    });
    await publish('neighborhood_context', 'neighborhood_context.geojson', neighborhoodContent, {
      format: 'geojson',
      geometryCrs: 'EPSG:4326',
      coverage: { start: '2008-12-16', end: '2026-09-20' },
      grain: 'one official NTA BX1001 boundary and the nearest historical and current outside monitoring points',
      sourceIds: ['nyc_nta_westchester_square_2020_20260922', ...workbookSourceIds, 'nyccas_pm25_archive_20260921'],
      sourceUrls: [NTA_URL, NYCCAS_URL, 'https://github.com/nychealth/nyccas-data'],
      limitations: neighborhoodContext.limitations,
    });

    const manifest = {
      release_id: RELEASE_ID,
      schema_version: '2.2.0',
      generated_at: generatedAt,
      status: 'validated',
      transform_version: TRANSFORM_VERSION,
      source_ids: [...new Set(assets.flatMap((asset) => asset.source_ids))],
      coverage: previousManifest.coverage,
      limitations: [
        ...previousManifest.limitations,
        'CONFIDENCE reports source data quality and coverage facts, not a statistical confidence score.',
        'HOTSPOTS ranks sampled DOT observations and is not a pollution, displacement, or causal finding.',
        'No supplied monitor is inside official Westchester Square NTA BX1001; outside sites are not neighborhood measurements.',
      ],
      assets,
      policy_reference_date: previousManifest.policy_reference_date,
    };
    const quality = {
      release_id: RELEASE_ID,
      status: 'validated',
      source_quality: {
        workbook_rows: workbookRows,
        westchester_square: westchester,
        retained_assets_with_verified_checksums: previousManifest.assets.length,
      },
      assets: assets.map(({ kind, path: assetPath, bytes, sha256: digest }) => ({ kind, path: assetPath, bytes, sha256: digest })),
    };
    const readme = `# Toll Shadow Data Release ${RELEASE_ID}\n\nThis immutable release retains every asset from 2026-09-21.1 and adds direct NYCCAS data-quality coverage plus official Westchester Square geography. HOTSPOTS uses the retained sampled DOT observations. All measures are descriptive and non-causal.\n`;
    const manifestContent = json(manifest, true);
    await Promise.all([
      writeFile(path.join(releaseDirectory, 'manifest.json'), manifestContent),
      writeFile(path.join(publicReleaseDirectory, 'manifest.json'), manifestContent),
      writeFile(path.join(publicDataRoot, 'manifest.json'), manifestContent),
      writeFile(path.join(releaseDirectory, 'quality.json'), json(quality, true)),
      writeFile(path.join(releaseDirectory, 'README.md'), readme),
    ]);
    return { manifest, quality };
  } catch (error) {
    if (canonicalCreated) await rm(releaseDirectory, { recursive: true, force: true });
    if (publicCreated) await rm(publicReleaseDirectory, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
