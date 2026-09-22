# Confidence, Hotspots, and Westchester Square Evidence Release

**Approved in chat:** 2026-09-22  
**Target release:** `2026-09-22.1`

## Goal

Replace the production empty states for CONFIDENCE and HOTSPOTS with source-backed,
descriptive views. Preserve every asset and feature in release `2026-09-21.1`, the
checksum-verification boundary, accessibility behavior, shareable URL state, CI gates,
and the prohibition on causal claims.

The four supplied NYCCAS workbooks are evidence for sampling coverage and reported data
quality. They are not evidence for an unadjusted neighborhood pollution ranking. The
workbooks state that raw samples are not directly representative of the sampled time or
place and require temporal adjustment and modeling before describing pollution across
New York City.

## Source Findings

The source set is the NYC Department of Health and Mental Hygiene NYCCAS year 1 through
17 release dated 2026-08-10:

- `EC_raw_data_year1_17.xlsx`: 7,491 rows, 177 site IDs, 2008-12-17 through 2025-11-26;
- `NOX_raw_data_year1_17.xlsx`: 7,757 rows, 177 site IDs, 2008-12-16 through 2025-11-24;
- `PM_raw_data_year1_17.xlsx`: 7,555 rows, 177 site IDs, 2008-12-17 through 2025-11-26;
- `O3_raw_data_year1_17.xlsx`: 1,970 rows, 177 site IDs, summer 2009 through summer 2025.

The release contains pollutant results, coordinates, site and post identifiers, reference
site status, site continuity classes, and two source QA flags. The source dictionary says
that QA flags did not prohibit use in analysis, so the pipeline reports flags but does not
silently discard flagged rows.

NYC Planning's official 2020 Neighborhood Tabulation Area dataset identifies Westchester
Square as `BX1001`. No historical NYCCAS site coordinate falls inside that polygon. The
nearest historical site is `12528-EJ`, approximately 0.19 km outside the boundary. No
current monitor in the supplied station history falls inside it; Hunts Point is the nearest
current monitor at approximately 3.31 km outside. Current-monitor locations come from the
checksum-verified daily-air asset in release `2026-09-21.1`; no unpinned station file is
introduced. Distances are measured from each point
to the official polygon boundary and must be recomputed by the pipeline, not hard-coded.

## Measure Specifications

### NYCCAS data quality and coverage

The CONFIDENCE tab is retitled in-panel as **Data quality and coverage**. CONFIDENCE
remains the stable navigation and URL identifier, but the view must never display a
statistical confidence score, high/medium/low bucket, uncertainty interval, or inferred
pollution quality.

The approved measures are direct source counts:

- total source rows by pollutant workbook;
- non-null and null analytic-result counts by pollutant field;
- rows carrying source `flag1`, `flag2`, either flag, or neither flag;
- distinct site/post combinations and distinct source site IDs;
- minimum and maximum sample start dates;
- sample counts and coverage windows by site/post and pollutant;
- source-declared reference and continuity classes without reinterpretation.

EC exposes both supplied analytic fields, `bc_conc` and `ec_abs_iso`, separately. Negative
source values remain source values for completeness accounting and are not clipped,
reclassified, or shown as neighborhood concentrations. `NULL` means missing and is never
converted to zero.

The published browser asset contains aggregate counts and site/post coverage metadata,
not the raw concentration rows. Every metric carries the workbook source, release date,
coverage, transform version, checksum, and the source warning about temporal adjustment,
modeling, and non-regulatory comparability.

### Westchester Square coverage

The CONFIDENCE view includes an official-area coverage section backed by the `BX1001`
polygon. It reports:

- zero historical NYCCAS sites inside the official boundary;
- zero current supplied monitors inside the official boundary;
- the nearest historical site and nearest current monitor, each with boundary distance;
- an explicit statement that outside sites are not Westchester Square measurements.

The map may draw the official boundary and the nearest points, but outside points must be
styled and labeled as outside. The product must not average those sites, estimate a value
for the polygon, or substitute a broader Bronx or South Bronx grouping. The UI also avoids
calling Westchester Square a South Bronx geography; it uses the official source name and
borough only.

### Observed traffic hotspots

HOTSPOTS is backed by the existing validated `traffic_observations` asset. A hotspot is
defined narrowly as a rank position among the published DOT segment aggregates matching
the selected month, borough, day type, and time band.

The default ranking is descending `mean_observed_15_min_volume`. The user may switch to
descending `max_observed_15_min_volume` or descending source observation count. Ties use
stable segment ID, direction, day type, and time-band ordering. The view reports the row's
observed-day count and source-observation count beside each value so sparse sampled data
does not look continuous.

The ranking is descriptive. It is not an exceedance, pollution hotspot, displacement
finding, citywide traffic estimate, or evidence that congestion pricing caused a change.
It does not combine traffic with historical or current air measurements.

## Release Contract

Release `2026-09-22.1` is immutable and retains the eight manifest entries from
`2026-09-21.1` with byte-for-byte checksum verification. It adds:

- `air_quality_context`: validated JSON containing workbook-level QA/coverage summaries
  and site/post coverage metadata;
- `neighborhood_context`: EPSG:4326 GeoJSON containing the official Westchester Square
  boundary and explicitly classified nearest outside points.

The release manifest schema adds those two asset kinds. Both assets declare source IDs,
authoritative URLs, exact coverage, grain, transform version, checksums, byte counts,
status, and limitations. Raw XLSX files are pinned as non-public pipeline inputs with
SHA-256 checksums; they are never copied into `public/` or `dist/`.

The pipeline uses a pinned `openpyxl` version for structured XLSX parsing. It validates
required worksheets and headers, rejects duplicate site/post/start-time pollutant rows,
validates finite coordinates, preserves source strings and QA flags, and fails closed on
schema drift. NYC Open Data supplies a pinned `BX1001` GeoJSON snapshot. Point-in-polygon
and nearest-boundary distance calculations are tested against simple fixtures and the
pinned source geometry.

## Product Behavior

CONFIDENCE loads both new assets through the existing checksum-verifying release hooks.
It provides pollutant selection, direct QA/coverage metrics, a site search, and the
Westchester Square coverage section. Changing pollutant or site updates only published
counts and map points; no concentration estimate is generated.

HOTSPOTS reuses the current traffic filters and shared timeline month. The same filtered
rows drive the ranking and map. Selecting a ranked row highlights its published point and
shows its source dimensions and observation coverage. Empty selections state that no
published aggregate matches instead of falling back to another period.

Production imports no synthetic hotspot or confidence implementation. Development-only
prototype panels remain isolated behind the development flag until they can be removed in
a separate cleanup. The production bundle and end-to-end tests must prove that neither
synthetic panel renders or supplies a value.

## Failure Handling

Missing or checksum-invalid assets produce the existing module failure state and no
figures. An invalid workbook, changed sheet/header, duplicate key, malformed coordinate,
unknown polygon, or checksum mismatch stops release construction. A Westchester Square
result other than zero in-boundary sites is treated as a review-triggering pipeline change,
not silently accepted.

## Verification

Pipeline tests cover workbook schema validation, exact source row counts, missing-value
accounting, QA-flag accounting, duplicate rejection, date bounds, coordinate validation,
point-in-polygon behavior, outside-point distance, and the expected zero-site Westchester
Square result.

Frontend tests cover manifest parsing for both new asset kinds, strict asset parsers,
CONFIDENCE direct metrics and no-score language, HOTSPOTS ranking and tie breaks, URL
state, empty/error states, map selection, source links, claim guardrails, and absence of
synthetic production values. End-to-end coverage adds CONFIDENCE and HOTSPOTS to the
published-module matrix on desktop and phone viewports.

Before deployment, run lint, unit tests, pipeline tests, typecheck/production build,
release acceptance, accessibility checks, and the complete browser suite. Review the
release diff for removed prior assets or features, deploy to a Firebase preview channel,
smoke-test every evidence tab and Westchester Square, then promote the exact previewed
build to `https://tollshallows.web.app` and verify the live manifest and recovery route.
