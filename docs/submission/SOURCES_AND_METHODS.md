# Sources and Methods

The authoritative source register is `data/catalog/sources.yaml` and holds **17 entries**. This
document summarizes which of them feed release `2026-09-20.4`, and what each published measure means.
The register is the source of truth; if this document and the register disagree, the register wins.

## Sources used by the release

Six sources feed six published assets. Every one is recorded with its SHA-256 in the register, and the
manifest carries the same checksums, which the browser re-verifies before rendering.

| Source ID | Publisher | Coverage | Grain | Published as |
|---|---|---|---|---|
| `dot_automated_traffic_counts_archive_20260915` | NYC Department of Transportation (NYC Open Data `7ym2-wayt`) | 2024-01-01 → 2025-12-31 | One sampled count observation per segment, timestamp, and direction | `traffic_observations` |
| `mta_daily_bridge_tunnel_traffic_archive_20260915` | Metropolitan Transportation Authority (NY State Open Data `fcbp-umit`) | 2024-01-01 → 2025-04-12 | One calendar-day aggregate per toll plaza and direction | `facility_crossings` |
| `mta_crz_entries_archive_20260920` | Metropolitan Transportation Authority, derived here from Socrata `t6yz-b64h` | 2025-01-01 → 2026-09-30 | One calendar-month aggregate per CRZ detection group | `crz_context` |
| `nyccas_air_context_derived_2016` | New York City Community Air Survey, derived here from the archived ESRI grid | 2016-01-01 → 2016-12-31 | One modelled value per pooled ~600 m grid cell | `historical_context` |
| `nys_asthma_context_derived_historical` | New York State Department of Health (archived extract) | 2000-01-01 → 2019-12-31 | One rolling multi-year period per county (borough) | `health_context` |
| `nyc_dac_context_derived_2023` | NYS Climate Justice Working Group / NYSERDA, archived subset | 2023-01-01 → 2023-12-31 | One archived census-tract feature | `dac_context` |

Raw and derived inputs are held immutably under `data/` and recorded in the register. The pipeline
reads them; nothing writes back.

### The four derived sources are reproducible, not inherited

Each `*_derived_*` source records the recipe that produced it, next to the register entry, in
`pipeline/scripts/`: `derive-air-context.py`, `derive-health-context.py`, `derive-equity-context.py`.
The CRZ source records the SoQL aggregate query it was built from. This matters because the older
Kepler-era derivatives could not be reproduced from anything in the repository, which is why they are
no longer release inputs.

**Source semantics that constrain the product.** The DOT raw geometry is tied to LION `SegmentID`, and
NYC Planning LION metadata establishes the projected CRS as EPSG:2263 — the raw coordinate column is
never assumed to be longitude/latitude. The MTA crossings view is a *daily aggregate of an hourly
source*, so this release cannot support hourly analysis even though the companion MTA overview PDF
describes hourly data. The CRZ rows are **detection-group areas, not detector points**.

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

Six measures, all with `claim_policy: descriptive_only`.

### `dot_monthly_sampled_traffic_volume` → `traffic_observations`

- **Numerator:** sum of non-negative observed 15-minute traffic volumes in the group.
- **Denominator:** number of validated raw DOT observations in the group.
- **Aggregation:** `mean_observed_15_min_volume = numerator / denominator`, plus maximum observed volume, observation count, distinct observed days, and count-session count.
- **Grouping:** one row per segment, borough, direction, calendar month, day type, and time band.
- **Dimensions:** `day_type` is `Weekday` or `Weekend` (Saturday and Sunday are weekend). `time_band` is one of Overnight (22-06), AM peak (06-09), Midday (09-16), PM peak (16-19), Evening (19-22); the labels match the legacy Kepler table so the two can be compared.
- **Inclusion:** calendar date inside coverage; valid DOT contract row with non-negative volume.
- **Exclusion:** invalid source row, including the archived negative-volume sentinel (`-1`).
- **Empty groups:** a combination the source never observed is omitted, not published as zero. The release carries the **2,561** groups that exist out of 40,950 possible cells.
- **Published:** 2,561 features, 1.99 MiB.

### `mta_daily_facility_crossings` → `facility_crossings`

- **Numerator:** daily E-ZPass vehicles, or daily VToll vehicles, as supplied by MTA.
- **Denominator:** `total_vehicles = E-ZPass + VToll` for the same source row.
- **Aggregation:** one validated source aggregate per date, plaza, and direction; the E-ZPass share is computed only when `total_vehicles > 0`.
- **Facility naming:** every published record carries `facility_code` and `facility_name` resolved from the register's `facility_ids` mapping. An unmapped plaza fails the build rather than publishing an identifier-only record, so no record can render nameless. All **8,352** records are named.
- **Inclusion:** calendar date inside coverage; valid MTA daily contract row with a known plaza ID and an `I`/`O` direction.
- **Exclusion:** invalid source row.
- **Published:** 8,352 records, 3.43 MiB.

### `crz_monthly_detection_group_entries` → `crz_context`

- **Numerator:** `crz_entries` summed over the group's rows.
- **Denominator:** none; this is a published count, not a rate.
- **Grouping:** detection group and calendar month.
- **Inclusion:** valid CRZ contract row with integer entry counts.
- **Limitations:** aggregated, not raw; detection groups are **areas, not points**, so the module states that entries are not attributed to a coordinate.
- **Published:** 252 rows, 12 detection groups, 21 months, 83 KB.

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

## How the policy reference date is used

`2025-01-05` is published in the manifest as `policy_reference_date` and rendered as a **timeline marker only**. It does not create a before/after comparison, a counterfactual, or a causal estimate. The measure specs carry no policy-period field, and no published asset contains a `policy_period` or `congestion_period` column.

## Limitations carried into the product

- DOT counts are **samples**. They do not represent continuous or full-year traffic measurement.
- Blank street labels are retained as `null` metadata and are never inferred or filled in.
- The MTA source is a **daily** aggregate view and cannot support hourly analysis.
- Archive coverage for MTA crossings ends **2025-04-12**.
- CRZ rows are detection-group **areas**, and the release says so wherever they are shown.
- The air surface is **relative within itself** with no established units.
- Every published coordinate is the coordinate the release published; the map never synthesizes a location.
