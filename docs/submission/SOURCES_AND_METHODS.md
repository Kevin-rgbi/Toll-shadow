# Sources and Methods

The authoritative source register is `data/catalog/sources.yaml`. This document summarizes which entries feed Release 1 and what each published measure means.

## Sources used by Release 1

| Source ID | Publisher | Coverage | Grain | Published use |
|---|---|---|---|---|
| `dot_automated_traffic_counts_archive_20260915` | NYC Department of Transportation (NYC Open Data `7ym2-wayt`) | 2000-01-01 → 2026-02-03 | One sampled count observation per street segment, timestamp, and direction | Observed traffic aggregation, published as `traffic_observations` |
| `mta_daily_bridge_tunnel_traffic_archive_20260915` | Metropolitan Transportation Authority (NY State Open Data `fcbp-umit`) | 2010-01-01 → 2025-04-12 | One calendar-day aggregate per toll plaza and direction | Observed facility-crossing comparison, published as `facility_crossings` |

Both raw files are held immutably under `data/raw/` and are recorded with SHA-256 checksums in the register. The pipeline reads them; nothing writes back.

**Source semantics that constrain the product.** The DOT raw geometry is tied to LION `SegmentID`, and NYC Planning LION metadata establishes the projected CRS as EPSG:2263 — the raw coordinate column is never assumed to be longitude/latitude. The MTA catalog view is a *daily aggregate of an hourly source*, so this release cannot support hourly analysis even though the companion MTA overview PDF describes hourly data.

## Sources deliberately excluded from Release 1

| Source ID | Reason for exclusion |
|---|---|
| `dot_traffic_kepler_legacy_2024_2025`, `mta_bridge_tunnel_kepler_legacy_2024_2025`, `mta_crz_vehicle_entries_summary_archive`, `mta_cbd_taxi_zones_legacy_20260911` | Legacy derivatives whose transformation recipe is not recorded. Retained as Kepler reproducibility references, not as release inputs. |
| `nys_dac_archive_2023`, `nyc_dac_archive_subset_2023` | Archived 2023 equity layers requiring an owner release decision; the 2025 Version 2.0 criteria update makes a "current DAC" claim unsupportable. |
| `nyccas_air_rasters_archive_2008_2019` | Historical modeled surfaces, not current or localized measurement. |
| `nys_asthma_archive_historical`, `nyc_asthma_kepler_legacy_historical` | Historical county/borough context ending 2019; unusable as a post-2025 outcome. |

The exclusion list is enforced by the release build, not by convention: `pipeline/methods/release-1.yaml` records each excluded asset kind with its reason.

## Measure specifications

### `dot_monthly_sampled_traffic_volume` → `traffic_observations`

- **Numerator:** sum of non-negative observed 15-minute traffic volumes in the group.
- **Denominator:** number of validated raw DOT observations in the group.
- **Aggregation:** `mean_observed_15_min_volume = numerator / denominator`, plus maximum observed volume, observation count, distinct observed days, and count-session count.
- **Grouping:** one row per segment, borough, direction, calendar month, day type, and time band.
- **Dimensions:** `day_type` is `Weekday` or `Weekend` (Saturday and Sunday are weekend). `time_band` is one of Overnight (22-06), AM peak (06-09), Midday (09-16), PM peak (16-19), Evening (19-22); the labels match the legacy Kepler table so the two can be compared.
- **Inclusion:** calendar date inside coverage; valid DOT contract row with non-negative volume.
- **Exclusion:** invalid source row, including the archived negative-volume sentinel (`-1`).
- **Empty groups:** a combination the source never observed is omitted, not published as zero. The release carries the 2,561 groups that exist out of 40,950 possible cells.
- **Claim policy:** descriptive only.

### `mta_daily_facility_crossings` → `facility_crossings`

- **Numerator:** daily E-ZPass vehicles, or daily VToll vehicles, as supplied by MTA.
- **Denominator:** `total_vehicles = E-ZPass + VToll` for the same source row.
- **Aggregation:** one validated source aggregate per date, plaza, and direction; the E-ZPass share is computed only when `total_vehicles > 0`.
- **Inclusion:** calendar date inside coverage; valid MTA daily contract row with a known plaza ID and an `I`/`O` direction.
- **Exclusion:** invalid source row.
- **Claim policy:** descriptive only.

## How the policy reference date is used

`2025-01-05` is published in the manifest as `policy_reference_date` and rendered as a **timeline marker only**. It does not create a before/after comparison, a counterfactual, or a causal estimate. The measure specs carry no policy-period field, and no published asset contains a `policy_period` or `congestion_period` column.

## Limitations carried into the product

- DOT counts are **samples**. They do not represent continuous or full-year traffic measurement.
- Blank street labels are retained as `null` metadata and are never inferred or filled in.
- The MTA source is a **daily** aggregate view and cannot support hourly analysis.
- Archive coverage for MTA crossings ends **2025-04-12**.
- Every published coordinate is the coordinate the release published; the map never synthesizes a location.

## Facility naming

The source register resolves plaza identifiers 21–30 to named facilities from authority metadata. The **published asset does not include facility names**, so the crossings module presents published plaza identifiers only and states that no name mapping is published. Naming the facilities in the UI would require the pipeline to publish (and validate) that mapping first; see `KNOWN_GAPS.md`.
