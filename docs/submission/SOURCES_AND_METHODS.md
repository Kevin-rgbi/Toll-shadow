# Sources and Methods

The authoritative source register is `data/catalog/sources.yaml` and holds **25 entries**.
Each published asset carries its source's registered `authoritative_url` in the manifest, and every
module renders it as a link, because the PRD requires a source URL on every displayed metric and a
register identifier is not a link. The build refuses to publish an asset whose source has no recorded
URL.

This document summarizes which of the register's entries feed the published release, and what each
published measure means. The register is the source of truth; if this document and the register
disagree, the register wins.

## Sources used by the release

Twelve sources feed ten published assets; measured AIR has separate daily and hourly files. Every
source is recorded with its SHA-256 in the register, and the manifest carries asset checksums that the
browser re-verifies before rendering.

| Source ID | Publisher | Coverage | Grain | Published as |
|---|---|---|---|---|
| `dot_automated_traffic_counts_archive_20260915` | NYC Department of Transportation (NYC Open Data `7ym2-wayt`) | 2024-01-01 → 2026-02-03 | One sampled count observation per segment, timestamp, and direction | `traffic_observations` |
| `mta_hourly_crossings_archive_20260921` | Metropolitan Transportation Authority (NY State Open Data `ebfx-2m7v`) | 2025-01-01 → 2026-09-08 | One hourly facility, direction, and payment-method aggregate; published at daily grain | `facility_crossings` |
| `mta_crz_entries_archive_20260921` | Metropolitan Transportation Authority (NY State Open Data `t6yz-b64h`) | 2025-01-05 → 2026-09-12 | One calendar-month aggregate per CRZ detection group | `crz_context` |
| `nyccas_pm25_archive_20260921` | NYC Department of Health and Mental Hygiene / NYCCAS | 2025-01-01 UTC → 2026-09-21 UTC | One active monitor and UTC hour, plus a New York local-day aggregate | `air_measurements` (daily and hourly) |
| `nyccas_air_context_derived_2016` | New York City Community Air Survey, derived here from the archived ESRI grid | 2016-01-01 → 2016-12-31 | One modelled value per pooled ~600 m grid cell | `historical_context` |
| `nys_asthma_context_derived_historical` | New York State Department of Health (archived extract) | 2000-01-01 → 2019-12-31 | One rolling multi-year period per county (borough) | `health_context` |
| `nyc_dac_context_derived_2023` | NYS Climate Justice Working Group / NYSERDA, archived subset | 2023-01-01 → 2023-12-31 | One archived census-tract feature | `dac_context` |
| `nyccas_ec_year1_17_20260810` | NYC DOHMH / NYCCAS | 2008-12-16 → 2025-11-26 | Raw EC/BC workbook rows summarized by source field and site/post | `air_quality_context` |
| `nyccas_nox_year1_17_20260810` | NYC DOHMH / NYCCAS | 2008-12-16 → 2025-11-26 | Raw NO/NO2 workbook rows summarized by source field and site/post | `air_quality_context` |
| `nyccas_pm_year1_17_20260810` | NYC DOHMH / NYCCAS | 2008-12-16 → 2025-11-26 | Raw PM2.5 workbook rows summarized by source field and site/post | `air_quality_context` |
| `nyccas_o3_year1_17_20260810` | NYC DOHMH / NYCCAS | 2009-05-27 → 2025-08-20 | Raw O3 workbook rows summarized by source field and site/post | `air_quality_context` |
| `nyc_nta_westchester_square_2020_20260922` | NYC Department of City Planning | 2020 geography | Official NTA `BX1001` polygon | `neighborhood_context` |

Raw and derived inputs are held immutably under `data/` and recorded in the register. The pipeline
reads them; nothing writes back.

### Derived assets are reproducible, not inherited

Each `*_derived_*` source records the recipe that produced it, next to the register entry, in
`pipeline/scripts/`: `derive-air-context.py`, `derive-health-context.py`, and
`derive-equity-context.py`. The measured-air recipe is `derive-air-measurements.py`; the crossings and
CRZ snapshots record their exact SoQL queries in `data/source-snapshots/2026-09-21/retrieval.json`.
This matters because the older Kepler-era derivatives could not be reproduced from anything in the
repository, which is why they are no longer release inputs.

**Source semantics that constrain the product.** The DOT raw geometry is tied to LION `SegmentID`, and
NYC Planning LION metadata establishes the projected CRS as EPSG:2263 — the raw coordinate column is
never assumed to be longitude/latitude. MTA crossings are aggregated to daily facility/direction
records while retaining the E-ZPass and Tolls by Mail components; one missing payment component stays
null. The CRZ rows are **detection-group areas, not detector points**.

## Sources deliberately excluded

| Source ID | Reason |
|---|---|
| `dot_traffic_kepler_legacy_2024_2025`, `mta_bridge_tunnel_kepler_legacy_2024_2025`, `mta_cbd_taxi_zones_legacy_20260911`, `nyc_asthma_kepler_legacy_historical`, `mta_crz_vehicle_entries_summary_archive` | Legacy derivatives whose transformation recipe is not recorded. Retained as Kepler reproducibility references, not as release inputs. |
| `nys_dac_archive_2023`, `nyccas_air_rasters_archive_2008_2019`, `nys_asthma_archive_historical` | Superseded by the derived context sources above, which carry a recorded recipe and a narrower, labelled claim. The originals remain registered so the derivation can be audited. |
| `nyc_dac_archive_subset_2023` | Superseded by `nyc_dac_context_derived_2023`. |

The exclusion list is enforced by the release build, not by convention:
`pipeline/methods/release-1.yaml` records each excluded asset kind with its reason. One kind remains
excluded — `cbd_boundary`, whose legacy derivative needs geometry and release validation.

## Measure specifications

Ten measures, all with `claim_policy: descriptive_only`.

### `dot_monthly_sampled_traffic_volume` → `traffic_observations`

- **Numerator:** sum of non-negative observed 15-minute traffic volumes in the group.
- **Denominator:** number of validated raw DOT observations in the group.
- **Aggregation:** `mean_observed_15_min_volume = numerator / denominator`, plus maximum observed volume, observation count, distinct observed days, and count-session count.
- **Grouping:** one row per segment, borough, direction, calendar month, day type, and time band.
- **Dimensions:** `day_type` is `Weekday` or `Weekend` (Saturday and Sunday are weekend). `time_band` is one of Overnight (22-06), AM peak (06-09), Midday (09-16), PM peak (16-19), Evening (19-22); the labels match the legacy Kepler table so the two can be compared.
- **Inclusion:** calendar date inside coverage; valid DOT contract row with non-negative volume.
- **Exclusion:** invalid source row, including the archived negative-volume sentinel (`-1`).
- **Empty groups:** a combination the source never observed is omitted, not published as zero.
- **Published:** 2,711 features, 1.43 MiB.

### `mta_hourly_facility_crossings` → `facility_crossings`

- **Numerator:** daily E-ZPass vehicles and daily Tolls by Mail vehicles, aggregated from official hourly rows.
- **Denominator:** `total_vehicles = E-ZPass + Tolls by Mail` only when both payment components are present; otherwise the available count is retained and payment share is null.
- **Aggregation:** one record per New York calendar date, official facility ID and name, and full source direction label.
- **Facility naming:** every published record carries the source's `facility_id` and `facility_name`; the build rejects blank identifiers, names, or directions.
- **Inclusion:** source timestamp inside coverage and a recognized payment method.
- **Exclusion:** malformed, duplicate, or unknown payment aggregates.
- **Published:** 11,699 records, 3.97 MiB; one record has incomplete payment coverage.

### `crz_monthly_detection_group_entries` → `crz_context`

- **Numerator:** `crz_entries` summed over the group's rows.
- **Denominator:** none; this is a published count, not a rate.
- **Grouping:** detection group and calendar month.
- **Inclusion:** valid CRZ contract row with integer entry counts.
- **Limitations:** aggregated, not raw; detection groups are **areas, not points**, so the module states that entries are not attributed to a coordinate.
- **Published:** 252 rows, 12 detection groups, 21 months, 83 KB.

### `nyccas_pm25_measurements` → `air_measurements`

- **Hourly value:** preliminary PM2.5 concentration in µg/m³ for one active monitor and UTC hour.
- **Missingness:** every expected active-monitor hour is present; missing observations are explicit nulls and are never carried forward or converted to zero.
- **Daily aggregation:** America/New_York calendar-day mean, minimum, and maximum, published only when at least 75% of the expected 23, 24, or 25 local-day hours are observed (18, 18, or 19 hours respectively).
- **Relocation:** timestamped source coordinates are retained; a local day spanning a monitor relocation is labelled and its aggregate is withheld.
- **Published:** 217,872 hourly rows (198,205 observed and 19,667 null) and 9,093 daily rows for 15 sites.

### `nyccas_air_context_relative` → `historical_context`

- **Numerator / denominator:** none. The published field is **relative**, not a concentration.
- **Aggregation:** 2x2 mean of the 300 m source cells, nodata masked, then min-max normalised to this surface alone.
- **Values:** `0-1` within this surface. Absolute units are **not established** by the archive that is reachable here, so `values` says so and the module shows no numeric scale.
- **Labels:** pollutant and period are **inferred from the source filename** and labelled as inferred, not verified.
- **Published:** a 78x78 grid, 33 KB.

### `nys_asthma_historical_context` → `health_context`

- **Numerator / denominator:** none; rates are published exactly as the source supplied them and are never recomputed.
- **Fields:** age-adjusted rate per 10,000, annual age-adjusted rate per 10,000, events, and daily mean events. Rates and means are fractional; `events` is a whole count. The parser rejects a fractional event count and accepts a fractional rate.
- **Geography:** county, which for New York City is the borough.
- **Period:** rolling multi-year periods ending 2019 or earlier. This is historical context, not a post-policy outcome.
- **Published:** 132 records, 28 KB.

### `archived_dac_context_2023` → `dac_context`

- **Numerator / denominator:** none.
- **Field:** `Vulner_Pct`, the published vulnerability percentile per tract, carried as published and validated as a non-negative number.
- **Geography:** census-tract polygons clipped to New York City, simplified with a 0.0004 degree tolerance and preserved topology, **for display only**.
- **Vintage:** the **archived 2023** criteria. The 2025 Version 2.0 update makes a current-designation claim unsupportable, and the module states this rather than implying currency.
- **Published:** 958 features across 5 counties, 470 KB.

### `nyccas_source_quality_coverage` → `air_quality_context`

- **Numerator:** source rows with a present approved analytic field or a reported QA flag, depending on the displayed count.
- **Denominator:** all nonblank source rows in each pollutant workbook.
- **Aggregation:** direct completeness, QA, distinct-site, and site/post counts; no concentration is averaged, weighted, or imputed.
- **Published:** 7,491 EC, 7,757 NOX, 7,555 PM, and 1,970 O3 source rows summarized in 340,942 bytes.
- **Limitation:** these are source-quality and coverage facts, not a statistical confidence score.

### `westchester_square_monitor_coverage` → `neighborhood_context`

- **Geography:** official NYC NTA `BX1001`, Westchester Square, Bronx.
- **Aggregation:** hole-aware point-in-polygon counts and nearest point-to-boundary distance.
- **Published:** zero historical sites and zero current monitors inside; `12528-EJ` is 0.188 km outside and Hunts Point is 3.314 km outside.
- **Limitation:** neither outside point is a Westchester Square measurement and no neighborhood concentration is published.

### `dot_observed_segment_ranking` → retained `traffic_observations`

- **Ranking:** descending published mean, observed maximum, or source observation count within the selected traffic dimensions.
- **Tie break:** segment ID, direction, day type, then time band; the source array is not mutated.
- **Limitation:** rank is not an air-pollution hotspot, displacement finding, exceedance, or causal policy effect.

## How the policy reference date is used

`2025-01-05` is published in the manifest as `policy_reference_date` and rendered as a **timeline marker only**. It does not create a before/after comparison, a counterfactual, or a causal estimate. The measure specs carry no policy-period field, and no published asset contains a `policy_period` or `congestion_period` column.

## Limitations carried into the product

- DOT counts are **samples**. They do not represent continuous or full-year traffic measurement.
- Blank street labels are retained as `null` metadata and are never inferred or filled in.
- The interface publishes MTA crossings at **daily** grain even though the source snapshot is hourly.
- Archive coverage for MTA crossings ends **2026-09-08**.
- CRZ rows are detection-group **areas**, and the release says so wherever they are shown.
- Measured AIR is preliminary monitor data; missing and low-coverage periods remain visibly null.
- The air surface is **relative within itself** with no established units.
- Every published coordinate is the coordinate the release published; the map never synthesizes a location.
