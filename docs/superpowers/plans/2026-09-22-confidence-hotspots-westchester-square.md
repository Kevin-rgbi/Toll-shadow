# Confidence, Hotspots, and Westchester Square Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish source-backed CONFIDENCE and HOTSPOTS modules plus an honest Westchester Square coverage view as immutable release `2026-09-22.1`, then deploy the verified build to `https://tollshallows.web.app`.

**Architecture:** A strict Python derivation reads four pinned NYCCAS XLSX snapshots and an official NYC Planning polygon, then emits aggregate quality JSON and neighborhood GeoJSON without publishing raw concentrations. The frontend verifies both new assets through the existing manifest/checksum boundary; CONFIDENCE renders direct QA/coverage facts and HOTSPOTS ranks the existing published DOT observations. A new release builder copies all prior assets byte-for-byte, appends the two new assets, and fails if any retained checksum changes.

**Tech Stack:** Python 3.12, `openpyxl==3.1.5`, Node.js 22, TypeScript 6, React 19, Vitest, Playwright, MapLibre GL, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-09-22-confidence-hotspots-westchester-square-design.md`

## Global Constraints

- Preserve every asset and feature in release `2026-09-21.1`.
- CONFIDENCE remains the stable route ID but displays `Data quality and coverage`, never a statistical confidence score or bucket.
- HOTSPOTS ranks only published DOT observations and never combines traffic with air data.
- Raw NYCCAS concentrations are not published, ranked, averaged, clipped, or used as neighborhood estimates.
- Westchester Square is official NTA `BX1001`; outside points stay labeled outside and are never renamed as neighborhood monitors.
- Every browser asset is checksum-verified and includes source URL, coverage, grain, transform version, checksum, and limitations.
- Missing values remain missing, QA flags are reported without silent exclusion, and no causal congestion-pricing claim is permitted.
- Deploy only after lint, unit, pipeline, build, acceptance, accessibility, desktop, and mobile browser checks pass.

---

### Task 1: Pin And Validate The Source Inputs

**Files:**
- Create: `pipeline/requirements.txt`
- Create: `data/source-snapshots/2026-09-22/EC_raw_data_year1_17.xlsx`
- Create: `data/source-snapshots/2026-09-22/NOX_raw_data_year1_17.xlsx`
- Create: `data/source-snapshots/2026-09-22/PM_raw_data_year1_17.xlsx`
- Create: `data/source-snapshots/2026-09-22/O3_raw_data_year1_17.xlsx`
- Create: `data/source-snapshots/2026-09-22/westchester_square_nta.geojson`
- Modify: `data/catalog/sources.yaml`
- Modify: `.github/workflows/verify.yml`
- Modify: `pipeline/tests/source-catalog.test.mjs`

**Interfaces:**
- Consumes: user-supplied XLSX files and NYC Open Data dataset `9nt8-h7nd`, feature `BX1001`.
- Produces: five immutable source files with catalog IDs `nyccas_ec_year1_17_20260810`, `nyccas_nox_year1_17_20260810`, `nyccas_pm_year1_17_20260810`, `nyccas_o3_year1_17_20260810`, and `nyc_nta_westchester_square_2020_20260922`.

- [ ] **Step 1: Write the failing catalog test**

Change the expected source count from 20 to 25. Parse the catalog in the test and assert all five new IDs have `approval_status: approved_for_pipeline`, valid SHA-256 values, and retained local inputs.

```js
const result = await validateSourceCatalog({ catalogFile, root: dataRoot, requireInputs: true });
expect(result.sourceCount).toBe(25);
const ids = new Set(parse(readFileSync(catalogFile, 'utf8')).sources.map(source => source.source_id));
for (const id of EXPECTED_SOURCE_IDS) expect(ids.has(id)).toBe(true);
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run pipeline:test -- pipeline/tests/source-catalog.test.mjs`
Expected: FAIL because the five source entries and files do not exist.

- [ ] **Step 3: Pin the inputs and hashes**

Copy the four supplied files byte-for-byte into `data/source-snapshots/2026-09-22/`. Fetch only `BX1001` from the official Socrata GeoJSON endpoint, preserve its source properties and geometry, then compute `shasum -a 256` for all five files. Do not convert or rewrite the XLSX binaries.

- [ ] **Step 4: Register exact source semantics**

Add one catalog entry per workbook and one for the NTA. Workbook entries use the source's own coverage, field names, publisher, warning that raw samples require temporal adjustment/modeling, and forbidden claims. The NTA entry records dataset `9nt8-h7nd`, feature `BX1001`, EPSG:4326, and the rule that the boundary is statistical geography rather than a definitive neighborhood claim.

- [ ] **Step 5: Pin the parser dependency in CI**

Create:

```text
openpyxl==3.1.5
```

Add `python -m pip install -r pipeline/requirements.txt` after Python setup in `verify.yml`.

- [ ] **Step 6: Re-run catalog validation**

Run: `npm run pipeline:test -- pipeline/tests/source-catalog.test.mjs && npm run pipeline:validate-catalog`
Expected: PASS with 25 registered sources and matching file hashes.

- [ ] **Step 7: Commit the source boundary**

```bash
git add pipeline/requirements.txt data/source-snapshots/2026-09-22 data/catalog/sources.yaml .github/workflows/verify.yml pipeline/tests/source-catalog.test.mjs
git commit -m "data: pin NYCCAS quality and Westchester Square sources"
```

### Task 2: Derive Quality And Neighborhood Assets

**Files:**
- Create: `pipeline/src/nyccas_quality.py`
- Create: `pipeline/scripts/derive-nyccas-quality.py`
- Create: `pipeline/tests/nyccas_quality_test.py`
- Create: `pipeline/tests/fixtures/nyccas-quality/` (minimal generated XLSX and GeoJSON fixtures)
- Create: `data/contracts/nyccas-air-quality-context.yaml`
- Create: `data/contracts/westchester-square-context.yaml`
- Create: `pipeline/methods/confidence-hotspots-2026-09-22.yaml`
- Modify: `package.json`

**Interfaces:**
- Consumes: four workbook paths, the NTA GeoJSON path, and the checksum-pinned `data/releases/2026-09-21.1/nyccas_pm25_daily.csv` current-monitor asset.
- Produces: `derive_quality(workbooks: dict[str, Path], nta_path: Path, stations_path: Path) -> tuple[dict, dict]`, where the first object is `air_quality_context` schema `1.0.0` and the second is an EPSG:4326 FeatureCollection.

- [ ] **Step 1: Write failing Python unit tests**

Cover required sheet/header rejection, Excel date conversion, `NULL` accounting, both EC analytic fields, flag1/flag2 counts, duplicate `(site_id, post_no, start)` rejection, coordinate validation, point-in-polygon holes, nearest-boundary distance, and outside classification.

```python
def test_null_and_flags_are_counted_without_exclusion(tmp_path):
    result, _ = derive_quality(fixture_workbooks(tmp_path), NTA, CURRENT_AIR)
    pm = result["pollutants"]["PM2.5"]
    assert pm["source_rows"] == 3
    assert pm["analytic_fields"]["blk_corr_pm_ugm3"] == {"present": 2, "missing": 1}
    assert pm["qa"]["either_flag"] == 1
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `python3 -m unittest pipeline/tests/nyccas_quality_test.py -v`
Expected: FAIL because `pipeline.src.nyccas_quality` does not exist.

- [ ] **Step 3: Implement strict workbook parsing**

Use `openpyxl.load_workbook(path, read_only=True, data_only=True)`. Validate exact workbook/sheet/header contracts, normalize only source whitespace and `NULL`, parse Excel datetimes, reject non-finite coordinates/results and duplicate keys, and aggregate without exposing raw result rows.

```python
KEY_FIELDS = ("site_id", "post_no")
QA_FIELDS = ("flag1", "flag2")

def source_value(value):
    return None if value is None or str(value).strip() in {"", "NULL"} else value
```

- [ ] **Step 4: Implement geography calculations**

Read the pinned MultiPolygon, validate `nta2020 == "BX1001"`, classify historical and current points with a hole-aware ray crossing function, and compute nearest geodesic-approximate boundary distance in kilometers. Emit boundary, nearest historical point, and nearest current point as separate GeoJSON features with `inside: false` on outside points.

- [ ] **Step 5: Add the derivation CLI and method contracts**

The CLI accepts `--ec`, `--nox`, `--pm`, `--o3`, `--nta`, `--current-air`, `--quality-out`, and `--neighborhood-out`. The current-air input must match the checksum declared by release `2026-09-21.1`. The YAML measure spec declares direct numerator/denominator/aggregation language for completeness and QA counts plus `dot_observed_segment_ranking`, all with `claim_policy: descriptive_only`.

- [ ] **Step 6: Add a pipeline test script**

Add `pipeline:quality-test` to `package.json`:

```json
"pipeline:quality-test": "python3 -m unittest pipeline/tests/nyccas_quality_test.py -v"
```

- [ ] **Step 7: Run focused tests**

Run: `npm run pipeline:quality-test && npm run pipeline:test -- pipeline/tests/measure-spec.test.mjs pipeline/tests/contracts.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit the derivation unit**

```bash
git add pipeline/src/nyccas_quality.py pipeline/scripts/derive-nyccas-quality.py pipeline/tests/nyccas_quality_test.py pipeline/tests/fixtures/nyccas-quality data/contracts pipeline/methods/confidence-hotspots-2026-09-22.yaml package.json
git commit -m "feat(pipeline): derive NYCCAS quality and neighborhood context"
```

### Task 3: Build Immutable Release 2026-09-22.1

**Files:**
- Create: `pipeline/scripts/build-confidence-hotspots-release.mjs`
- Create: `data/releases/2026-09-22.1/README.md`
- Create: `data/releases/2026-09-22.1/air_quality_context.json`
- Create: `data/releases/2026-09-22.1/neighborhood_context.geojson`
- Create: `data/releases/2026-09-22.1/manifest.json`
- Create: `data/releases/2026-09-22.1/quality.json`
- Mirror validated browser assets under: `public/data/releases/2026-09-22.1/`
- Modify: `public/data/manifest.json`
- Modify: `data/contracts/release-manifest.yaml`
- Modify: `pipeline/tests/contracts.test.mjs`
- Modify: `pipeline/tests/release.test.mjs`
- Modify: `src/lib/releaseManifest.ts`
- Modify: `tests/frontend/releaseManifest.test.ts`

**Interfaces:**
- Consumes: release `2026-09-21.1`, Task 2 derivation CLI, and the five pinned source files.
- Produces: manifest kinds `air_quality_context` and `neighborhood_context` plus ten total release entries, with all eight prior asset bytes/checksums unchanged.

- [ ] **Step 1: Write failing release-contract tests**

Assert both new kinds parse, undeclared kinds still fail, neighborhood GeoJSON requires `EPSG:4326`, CSV remains restricted to `air_measurements`, exactly eight retained paths match prior SHA-256 values, and the new manifest has ten entries.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm run test -- tests/frontend/releaseManifest.test.ts && npm run pipeline:test -- pipeline/tests/contracts.test.mjs pipeline/tests/release.test.mjs`
Expected: FAIL because the kinds and release do not exist.

- [ ] **Step 3: Extend the manifest contract**

Append `air_quality_context` and `neighborhood_context` to `RELEASE_ASSET_KINDS`, `allowed_asset_kinds`, source labels, and domain-contract coverage. Keep all existing validation rules intact.

- [ ] **Step 4: Implement the immutable release builder**

The builder creates a temporary directory, runs Task 2, validates the expected source row counts and zero in-boundary sites, copies every prior browser asset only after matching its old checksum, publishes the two new files, computes hashes/bytes, and atomically writes canonical/public manifests. On any failure it removes only newly-created `2026-09-22.1` directories.

- [ ] **Step 5: Build the release**

Run the builder with pinned repository paths, including the prior release's checksum-verified daily-air asset. Expected summary:

```json
{"release_id":"2026-09-22.1","retained_assets":8,"new_assets":2,"westchester_square_historical_sites":0,"westchester_square_current_monitors":0}
```

- [ ] **Step 6: Re-run contracts and release tests**

Run: `npm run pipeline:test -- pipeline/tests/contracts.test.mjs pipeline/tests/release.test.mjs && npm run test -- tests/frontend/releaseManifest.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit the release boundary**

```bash
git add pipeline/scripts/build-confidence-hotspots-release.mjs data/releases/2026-09-22.1 public/data data/contracts/release-manifest.yaml pipeline/tests src/lib/releaseManifest.ts tests/frontend/releaseManifest.test.ts
git commit -m "release(2026-09-22.1): add quality and neighborhood evidence"
```

### Task 4: Build The CONFIDENCE Data Quality Module

**Files:**
- Create: `src/features/quality/qualityData.ts`
- Create: `src/features/quality/QualityModule.tsx`
- Create: `tests/frontend/qualityData.test.ts`
- Create: `tests/frontend/qualityModule.test.ts`
- Modify: `src/lib/sourceMessaging.ts`
- Modify: `src/styles/modules.css`

**Interfaces:**
- Consumes: `ReleaseAssetState<AirQualityContext>` and `ReleaseAssetState<FeatureCollection>`.
- Produces: `parseAirQualityContext(input, label): AirQualityContext`, `parseNeighborhoodContext(input, label): NeighborhoodContext`, and `QualityModule` with pollutant/site selection callbacks.

- [ ] **Step 1: Write failing strict-parser tests**

Assert schema/version, known pollutant fields, nonnegative integer counts, `present + missing == source_rows`, ordered coverage dates, unique site/post keys, valid lon/lat, exactly one `BX1001` boundary, exactly two outside nearest points, and zero in-boundary counts.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- tests/frontend/qualityData.test.ts tests/frontend/qualityModule.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement strict parsers and selectors**

Return typed immutable domain values and helpers for pollutant summaries, site search, and selected site coverage. Reject unknown structures rather than coercing them.

- [ ] **Step 4: Implement the accessible module**

Render direct source-row, present/missing, QA-flag, site, and coverage metrics. Use a pollutant `<select>`, a site search input, stable tables/lists, and a Westchester Square section that states zero in-boundary sites and labels both nearest points `outside the official boundary`. Render provenance for both assets.

- [ ] **Step 5: Assert prohibited confidence language**

Tests must reject `high confidence`, `medium confidence`, `low confidence`, `% confidence`, and any neighborhood concentration. They must require `Data quality and coverage`, `not a statistical confidence score`, and the workbook modeling warning.

- [ ] **Step 6: Run focused tests and lint**

Run: `npm run test -- tests/frontend/qualityData.test.ts tests/frontend/qualityModule.test.ts tests/frontend/sourceMessaging.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit the module**

```bash
git add src/features/quality src/lib/sourceMessaging.ts src/styles/modules.css tests/frontend/qualityData.test.ts tests/frontend/qualityModule.test.ts tests/frontend/sourceMessaging.test.ts
git commit -m "feat: publish data quality and Westchester Square coverage"
```

### Task 5: Build The Observed Traffic HOTSPOTS Module

**Files:**
- Create: `src/features/hotspots/hotspotRanking.ts`
- Create: `src/features/hotspots/HotspotsModule.tsx`
- Create: `tests/frontend/hotspotRanking.test.ts`
- Create: `tests/frontend/hotspotsModule.test.ts`
- Modify: `src/features/traffic/trafficSummary.ts`
- Modify: `src/styles/modules.css`

**Interfaces:**
- Consumes: filtered `TrafficObservation[]`, current traffic filters, and the existing traffic release asset.
- Produces: `rankObservedTraffic(rows, ranking): RankedTrafficObservation[]` where ranking is `mean | maximum | coverage`, plus `HotspotsModule` selection callbacks.

- [ ] **Step 1: Write failing ranking tests**

Assert descending mean, maximum, and observation-count rankings; deterministic ties by segment/direction/day/time; empty input; no mutation; and retention of observed-day and observation-count fields.

```ts
expect(rankObservedTraffic(rows, 'mean').map(row => row.segmentId)).toEqual(['high', 'low'])
expect(rows).toEqual(originalRows)
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test -- tests/frontend/hotspotRanking.test.ts tests/frontend/hotspotsModule.test.ts`
Expected: FAIL because the ranking module does not exist.

- [ ] **Step 3: Implement direct rankings**

Sort copies of published rows only. Expose the source values verbatim and never compute a composite score, effect, threshold exceedance, or air correlation.

- [ ] **Step 4: Implement the module**

Reuse month, borough, day type, and time-band controls and callbacks. Add a segmented ranking control, a keyboard-operable ranked list, selected-row details, source coverage, and the existing asset provenance. Use `Observed traffic hotspots` as the heading and repeat the sampled/non-causal limitation beside the ranking.

- [ ] **Step 5: Add claim-gate tests**

Require `observational`, `sampled`, and `not evidence that congestion pricing caused`; reject `pollution hotspot`, `displaced`, `impact score`, and `confidence` in rendered production output.

- [ ] **Step 6: Run focused tests and lint**

Run: `npm run test -- tests/frontend/hotspotRanking.test.ts tests/frontend/hotspotsModule.test.ts tests/frontend/trafficSummary.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit the module**

```bash
git add src/features/hotspots src/features/traffic/trafficSummary.ts src/styles/modules.css tests/frontend/hotspotRanking.test.ts tests/frontend/hotspotsModule.test.ts
git commit -m "feat: publish observed traffic hotspot rankings"
```

### Task 6: Wire Modules, URL State, And Maps

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Map/MapShell.tsx`
- Modify: `src/components/Map/mapConfig.ts`
- Modify: `src/lib/viewState.ts`
- Modify: `src/hooks/useShareableViewState.ts`
- Modify: `tests/frontend/appRender.test.ts`
- Modify: `tests/frontend/viewState.test.ts`
- Modify: `tests/e2e/modules.spec.ts`
- Modify: `tests/e2e/shell.spec.ts`
- Modify: `tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Consumes: Task 4 parsers/module and Task 5 ranking/module.
- Produces: release-backed CONFIDENCE and HOTSPOTS routes, shared traffic filter URL state, Westchester Square map focus, and selected published traffic point focus.

- [ ] **Step 1: Extend failing app and E2E expectations**

Add CONFIDENCE and HOTSPOTS to the published-module matrix. Require populated numeric metrics, provenance links, no `Not available for this claim`, no synthetic panel, and no console/page errors at desktop and mobile viewports.

- [ ] **Step 2: Run focused frontend tests and verify failure**

Run: `npm run test -- tests/frontend/appRender.test.ts tests/frontend/viewState.test.ts tests/frontend/sourceMessaging.test.ts`
Expected: FAIL because App still routes both modes to unavailable/synthetic-only branches.

- [ ] **Step 3: Load release assets only for active modes**

Enable `traffic_observations` for TRAFFIC or HOTSPOTS. Add checksum-verifying hooks for both new kinds only when CONFIDENCE is active. Remove production dependence on `buildSyntheticHotspotRankings` and `summarizeSyntheticConfidence`; keep development imports isolated in the existing dev boundary.

- [ ] **Step 4: Wire stable state and URL parameters**

Share current traffic filters with HOTSPOTS. Add `ranking=mean|maximum|coverage`, `qualityPollutant`, and `qualitySite` parameters with strict decoders and defaults omitted from generated URLs.

- [ ] **Step 5: Wire map data and focus**

HOTSPOTS uses the same filtered traffic FeatureCollection and selected published point as its list. CONFIDENCE draws the `BX1001` boundary and its two explicitly outside nearest points; selecting a point focuses it without changing its outside label. Extend both GPU and software map tests so either renderer shows nonblank output.

- [ ] **Step 6: Run unit, accessibility, and module E2E tests**

Run: `npm run test && npm run test:e2e -- tests/e2e/modules.spec.ts tests/e2e/shell.spec.ts tests/e2e/accessibility.spec.ts`
Expected: PASS, with all published tabs populated and synthetic dev panels absent.

- [ ] **Step 7: Commit integration**

```bash
git add src/App.tsx src/components/Map src/lib/viewState.ts src/hooks/useShareableViewState.ts tests
git commit -m "feat: wire quality and hotspot release modules"
```

### Task 7: Document, Verify, Commit, Push, And Deploy

**Files:**
- Modify: `README.md`
- Modify: `docs/DATA_STRATEGY.md`
- Modify: `docs/submission/KNOWN_GAPS.md`
- Modify: `docs/submission/TRACEABILITY.md`
- Modify: `docs/submission/RELEASE_EVIDENCE.md`
- Modify: `docs/submission/README.md`
- Modify: `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md`

**Interfaces:**
- Consumes: completed release `2026-09-22.1` and all prior tasks.
- Produces: reviewed Git history, green verification evidence, pushed `main`, Firebase preview, and production deployment at `https://tollshallows.web.app`.

- [ ] **Step 1: Update release documentation**

State exactly what CONFIDENCE and HOTSPOTS now mean, record the zero-site Westchester Square finding, remove only the two resolved gap statements, retain every unrelated gap, update test counts after the final run, and document the two new assets and sources.

- [ ] **Step 2: Run the complete local gate**

```bash
npm run lint
npm run pipeline:quality-test
npm run pipeline:test
npm run test
VITE_USE_DEMO_DATA=false npm run build
python3 scripts/release_acceptance.py
npm run test:e2e
```

Expected: every command exits 0; browser suite has no unexpected skips or failures.

- [ ] **Step 3: Review the final diff**

Run `git diff --check`, `git status --short --branch`, `git diff --stat 82c336b..HEAD`, `git diff --name-status 82c336b..HEAD`, and targeted diffs for manifest, App, claim copy, and docs. Confirm no prior asset path disappeared and no unrelated feature was deleted.

- [ ] **Step 4: Commit documentation and any verification-only fixes**

```bash
git add README.md docs
git commit -m "docs(release): record confidence and hotspots evidence"
```

- [ ] **Step 5: Push normally**

Run: `git push origin main`
Expected: fast-forward push with no force option.

- [ ] **Step 6: Rebuild after the final commit and deploy preview**

```bash
VITE_USE_DEMO_DATA=false npm run build
python3 scripts/release_acceptance.py
npx firebase hosting:channel:deploy release-2026-09-22-1 --project tollshallows --expires 7d
```

Smoke-test the preview manifest, all eight evidence tabs, Westchester Square zero-site text, checksums, source links, map render, accessibility, console, `/reset.html` headers, and representative figures.

- [ ] **Step 7: Promote the exact build and verify production**

```bash
npx firebase deploy --only hosting --project tollshallows
```

Verify `https://tollshallows.web.app/data/manifest.json` reports `2026-09-22.1`, `validated`, ten assets, and no synthetic marker. Re-run production browser smoke tests and confirm `/reset.html` still returns `Clear-Site-Data: "cache", "storage"`.

- [ ] **Step 8: Record deployment evidence**

Update the deployment timestamp, preview URL, Firebase version/release identifier, and production smoke result in release evidence; commit and push that documentation normally.
