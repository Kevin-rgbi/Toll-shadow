# Toll Shadow / TollShallow
## MHC Event Archive Audit and Project Context

**Audit date:** 2026-09-15  
**Archive reviewed:** [`MHC event -20260916T011445Z-1-001.zip`](</home/ihthos/Downloads/MHC event -20260916T011445Z-1-001.zip>)  
**Archive SHA-256:** `0887e0d43ed25a5403ac4efd313d2f0b45adb106d3db7efbe6ee624a3aa5cf44`

## Executive Summary

This archive is a research and visualization bundle for the Toll Shadow project: a New York City congestion-pricing analysis connecting traffic exposure, the Central Business District, disadvantaged communities, air-quality surfaces, and asthma indicators. It contains raw and prepared traffic data, MTA bridge and tunnel data, congestion detection summaries, NYC and New York State disadvantaged-community polygons, NYS asthma data and notes, an ArcInfo GRID air-quality collection, a Kepler.gl project export, map screenshots, and two PDFs.

The material is useful, but it is not yet a clean or reproducible data pipeline. The archive mixes raw downloads, transformed analysis tables, screenshots, GIS internals, metadata, and unrelated coursework at one level. Several filenames are misleading, important provenance is embedded only in metadata or column names, and some prepared files encode assumptions that need to be documented before they become project facts. The central finding is organizational rather than analytical: preserve the source material, establish a manifest and provenance chain, and make the app consume only clearly identified, source-backed derived data.

No source file was deleted, moved, overwritten, or modified during this audit. The ZIP passed `unzip -t` with no errors. The contents were extracted read-only to a temporary directory for inspection:

`/tmp/mhc-event-audit.rqvWod/MHC event `

The extracted directory name has a trailing space because the ZIP's top-level directory is named `MHC event `.

## Project Context

### Product and repository

- Project working name: **The Toll Shadow**.
- Firebase display name: **TollShallow**.
- GitHub repository audited earlier: `https://github.com/Kevin-rgbi/Toll-shadow`.
- The repository is currently a small React/Vite frontend using MapLibre, Zustand, D3, and canvas-based visualization components.
- The repository's checked-in demo data is synthetic. The archive contains the first substantial collection of real or source-backed project data found in this work.
- The repository currently has no implemented backend, ingestion pipeline, database schema, or analysis service. Its pipeline documentation is aspirational rather than an executable pipeline.

### Firebase status found during the earlier audit

- Authenticated Firebase CLI account: `kmzidni@gmail.com`.
- Actual Firebase project: `tollshallow` (singular), project number `1094344081770`, active.
- The repository's `.firebaserc` points to `tollshallows` (plural), which is a different project/site.
- The singular project's default Hosting site exists, but `tollshallow.web.app` returned Firebase's “Site Not Found” response during the audit.
- The plural site serves a different deployed synthetic app and is not the same Firebase project.
- No Firebase web apps were listed for the singular project. Realtime Database had no instances. Firestore and Cloud Functions APIs were disabled.
- `firebase.json` contains Hosting configuration only. There are no checked-in Functions, Firestore rules, Storage rules, or Auth configuration files.

**Implication:** this archive is not yet proven to be connected to the deployed app. The next integration step should be a deliberate source-to-frontend pipeline, not a direct upload of the whole archive.

## Archive Inventory

### Package-level facts

| Fact | Verified value |
|---|---:|
| ZIP size | 32,261,535 bytes |
| ZIP entries | 804 |
| Extracted file count | 804 |
| Extracted size | approximately 332 MB |
| Top-level regular files | 16 |
| ArcInfo GRID dataset directories | 88 |
| `.adf` files | 528 |
| `.ovr` overview files | 88 |
| `metadata.xml` files | 78 |
| TIFF raster files | 1 |
| GeoJSON files | 2 |
| PNG map screenshots | 3 |
| PDFs, including mislabeled `query.csv` | 3 |

### Top-level files

| File | Size | Role / assessment |
|---|---:|---|
| `Automated_Traffic_Volume_Counts_20260915 (1).csv` | 286,977,874 | Raw/large NYC DOT-style automated traffic observations. Preserve as raw. |
| `Automated_Traffic_Volume_Kepler_Clean_2024_2025.csv` | 531,358 | Prepared DOT traffic table for Kepler and policy-period comparison. |
| `Daily_Traffic_on_MTA_Bridges_&_Tunnels_20260915.csv` | 3,778,994 | Raw MTA traffic download; filename says daily, companion PDF describes an hourly dataset. |
| `MTA_Bridges_Tunnels_Kepler_2024_2025.csv` | 1,430,102 | Prepared MTA table for Kepler and policy-period comparison. |
| `MTA_Central_Business_District_Taxi_Zones_20260911.csv` | 144,858 | 38 WKT taxi-zone polygons used as the CBD boundary layer. |
| `MTA_HourlyTrafficBridgeTunnel_Overview.pdf` | 189,793 | MTA dataset documentation dated 2015. |
| `NYC_Disadvantaged_Communities.geojson` | 2,881,797 | 958 NYC polygon features, CRS84. |
| `NYS_Disadvantaged_Communities_(DAC).geojson` | 10,886,284 | 1,736 New York State polygon features, CRS84. |
| `Workshop 03a - Topic 3_ Chemical Compounds .pdf` | 678,143 | General Chemistry worksheet; appears unrelated to Toll Shadow. Quarantine for review, do not silently delete. |
| `asthma_data_notes.csv` | 1,614 | Plain-text data dictionary/notes incorrectly named as CSV. |
| `crz_kepler_detection_points.csv` | 2,970 | 12 manually summarized congestion-detection points with approximate coordinates. |
| `kepler.gl.png` | 850,794 | Kepler screenshot, 1316x685. |
| `kepler.gl (1).png` | 2,566,534 | Kepler screenshot, 2632x1370. |
| `kepler.gl (2).png` | 2,274,688 | Kepler screenshot, 2880x1624. |
| `nyc_asthma_kepler.csv` | 41,809 | Prepared borough-centroid asthma table for Kepler. |
| `org.apache.catalina.connector.RequestFacade@7e2236e5.csv` | 375,843 | Raw-looking NYS asthma table with a server-generated filename. Rename only after provenance is recorded. |
| `query.csv` | 163,593 | **Not CSV:** a 32-page PDF printout of a Socrata GeoJSON query for taxi zones. |
| `AnnAvg_1_16_300m/` | approximately 319 MB | ArcInfo GRID air-quality/raster collection with nested GRID components and metadata. |

## Dataset Details

### 1. Automated traffic volume: raw table

**File:** `Automated_Traffic_Volume_Counts_20260915 (1).csv`

- 1,875,154 data rows and 14 columns:
  `RequestID`, `Boro`, `Yr`, `M`, `D`, `HH`, `MM`, `Vol`, `SegmentID`, `WktGeom`, `street`, `fromSt`, `toSt`, `Direction`.
- Date coverage: 2000-01-01 through 2026-02-03.
- Five boroughs; 3,391 unique segment IDs; 2,236 request IDs.
- Directions: `NB`, `SB`, `EB`, `WB`, `EW`, and `NS`.
- Coordinates are WKT points in projected-looking NYC coordinate units, not latitude/longitude. The exact CRS is not declared in the file and must be confirmed before spatial joins.
- There are 1,246 blank cells and one negative volume value (`-1`). Missing/invalid values require an explicit policy.
- The filename date is a download/collection date, not the data end date.

This is a raw source candidate. It should not be replaced by the smaller Kepler table; the two serve different purposes.

### 2. Automated traffic volume: prepared Kepler table

**File:** `Automated_Traffic_Volume_Kepler_Clean_2024_2025.csv`

- 2,559 rows and 21 columns.
- Date/month coverage: 2024-01-01 through 2025-12-01; years 2024 and 2025.
- Five boroughs and four cardinal directions.
- Includes `latitude`, `longitude`, `avg_15min_volume`, `estimated_avg_hourly_volume`, `max_15min_volume`, `observations`, `days_sampled`, and `count_sessions`.
- Encodes `Before congestion pricing` and `After congestion pricing`, plus `Weekday`/`Weekend` and five time bands.
- August is absent from the observed `month` values.
- No blank cells were found.
- The policy-period labels and hourly estimate are derived fields. Their exact cutoff, aggregation formula, filtering, and handling of missing observations must be documented in a transformation script or method note.

This is the primary current candidate for a traffic map layer, but not yet a fully reproducible analysis product because its transformation recipe is not included in the archive.

### 3. MTA Bridges and Tunnels: raw table

**File:** `Daily_Traffic_on_MTA_Bridges_&_Tunnels_20260915.csv`

- 98,053 rows and five columns:
  `Date`, `Plaza ID`, `Direction`, `# Vehicles - E-ZPass`, `# Vehicles - VToll`.
- Date coverage: 2010-01-01 through 2025-04-12.
- 20 plaza IDs: `1` through `9`, `11`, and `21` through `30`.
- Directions are `I` and `O`.
- No blank cells were found.
- The data table has no `Hour` column even though the companion MTA overview describes hourly data. Treat this as a provenance/schema discrepancy until confirmed against the original dataset endpoint.

The raw table includes more plaza IDs than the 2015 PDF's nine-facility key. The later IDs need a verified mapping before interpretation.

### 4. MTA Bridges and Tunnels: prepared Kepler table

**File:** `MTA_Bridges_Tunnels_Kepler_2024_2025.csv`

- 8,352 rows and 19 columns.
- Date coverage: 2024-01-01 through 2025-04-12; 464 distinct dates.
- Ten facility codes: `BWB`, `CBB`, `HCT`, `HHB`, `MPB`, `QMT`, `TBM`, `TBX`, `TNB`, and `VNB`.
- Two directions: `I` and `O`.
- Includes facility name/type, `ezpass_vehicles`, `vtoll_vehicles`, `total_vehicles`, `ezpass_share_pct`, coordinates, and `Before congestion pricing`/`After congestion pricing`.
- Rows split into 6,588 before-policy and 1,764 after-policy records.
- No blank cells were found.

The prepared table is suitable for visualization after validating the facility-ID mapping and policy cutoff. It is not a substitute for the raw table.

### 5. Central Business District boundary

**Files:** `MTA_Central_Business_District_Taxi_Zones_20260911.csv` and `query.csv`

- The CSV contains 38 rows of `Taxi Zone` and WKT `Polygon`.
- `query.csv` is a 32-page PDF rendering of a GeoJSON FeatureCollection query. Text extraction confirms 38 features and 38 `taxi_zone` properties.
- The PDF title records this source query URL:
  `https://data.ny.gov/api/v3/views/yfdc-w5jh/query.geojson?accessType=DOWNLOAD`
- The Kepler export embeds the CSV polygon data and uses it as a heatmap layer labeled `MTA_Central_Business_District_Taxi_Zones_20260911.csv`.

The CSV is a transformed/map-ready version; the PDF is a source snapshot. Preserve both until the original download and transformation are formally recorded.

### 6. Congestion detection points

**File:** `crz_kepler_detection_points.csv`

- 12 rows, one per detection group: bridges, tunnels, and roadway points around Manhattan's Central Business District.
- Source window recorded in every row: 2025-01-05 through 2026-09-05, 609 days.
- Fields include CRZ entries, excluded roadway entries, all entries, daily averages, shares, peak/overnight counts, top vehicle class, and approximate latitude/longitude.
- Every coordinate note says the point is approximate and was added for Kepler mapping.
- The data is an aggregated summary, not raw detection records. It cannot independently establish causality, route displacement, or a precise facility boundary.

### 7. Disadvantaged communities

**Files:** `NYC_Disadvantaged_Communities.geojson` and `NYS_Disadvantaged_Communities_(DAC).geojson`

Both files are GeoJSON with CRS `urn:ogc:def:crs:OGC:1.3:CRS84`, and they share a large property schema including `GEOID`, `County`, `Pop_Cnt`, `PM25`, `Asthma`, `Traff_Veh`, `Vulner_Pct`, `Rank_State`, and related burden/vulnerability fields.

| Scope | Features | Geometry |
|---|---:|---|
| NYC | 958 | Polygon |
| New York State | 1,736 | 1,734 Polygon + 2 MultiPolygon |

The NYC file is a subset/scope-specific layer, not merely a display crop of the statewide file. The exact release date and authoritative source URL are not stated in the file itself and should be added to the project manifest.

### 8. Asthma health data

#### Raw-looking NYS table

**File:** `org.apache.catalina.connector.RequestFacade@7e2236e5.csv`

- 3,870 rows and 13 columns.
- Indicators: `Hospitalizations` and `ED Visits`.
- 65 counties/aggregate geographies.
- The `Year` field contains individual years, rolling ranges such as `2000-2002` through `2017-2019`, and aggregate ranges such as `2000-2019` and `2005-2019`.
- `subgroup1` includes `Total`, `AgeGroup`, and `Month`; `subgroup2` includes `Total` and `Gender`.
- Blank rates occur in subgroup rows where age-adjusted rates are not applicable; these blanks are part of the source structure, not automatically zeroes.

#### Notes/data dictionary

**File:** `asthma_data_notes.csv`

This is plain text despite its extension. It identifies the source as the New York State Department of Health Bureau of Biometrics and Health Statistics, references SPARCS information, defines the fields, and points to Census population estimates for state and county denominators.

#### Prepared NYC table

**File:** `nyc_asthma_kepler.csv`

- 155 rows: five boroughs across 31 records each.
- Indicators: 90 `Hospitalizations` and 65 `ED Visits`.
- Periods: 2000-2002 through 2017-2019.
- Rates and event counts are represented at the borough/county level.
- Every row explicitly says: `Approximate borough centroid; county-level health data`.
- Source field: New York State Department of Health asthma hospitalization and ED visit data.

This table must not be presented as neighborhood-level asthma monitoring or as a post-congestion-pricing health outcome. The period ends before the 2025 policy window and the coordinates are only borough centroids.

### 9. Air-quality raster collection

**Directory:** `AnnAvg_1_16_300m/`

- 88 ArcInfo GRID dataset directories, each composed primarily of six `.adf` files.
- 78 datasets include `metadata.xml`; 10 do not.
- The root contains five GRID directories: `aa16_no300m`, `aa16_no2300m`, `aa16_bc300m`, `aa16_pm300m`, and `s16_o3300m`.
- The nested `AnnAvg_1_15_300m/` directory contains 83 additional GRID directories.
- One dataset, `aa16_no300m`, has a materialized TIFF (`noAA16300m.tif`), world file, overview, and auxiliary XML. The other GRID datasets remain in ArcInfo component form.
- Representative metadata describes 32-bit floating-point, single-band GRID data with 157 cells per dimension, NAD83 / New York Long Island State Plane feet, and a 984-foot cell size, approximately 300 m.
- Representative metadata process text references inverse-distance-weighted interpolation, NYCCAS surface data, `OpenData300m`, borough-boundary clipping, and a NoData value near `-3.402823e+38`.
- Metadata source paths reference old Windows/local network locations such as `X:\EODEShare\NYCCAS` and `E:\OutputData\NYCCAS 9yr Surface`; these are provenance clues, not accessible paths on this machine.
- Filename patterns appear to represent pollutant families such as PM, NO, NO2, black carbon, ozone, and SO2, with numbered periods. The archive does not include a definitive naming codebook or a verified unit mapping for every family.

The raster collection is valuable but not immediately web-ready. It needs a deliberate conversion/tiling decision, CRS/unit documentation, a NoData policy, and a manifest that records which ten directories lack metadata.

### 10. PDFs and screenshots

#### MTA overview PDF

`MTA_HourlyTrafficBridgeTunnel_Overview.pdf` is a two-page 2015 MTA document. It describes traffic through MTA Bridges and Tunnels, says the dataset is collected weekly from the E-ZPass system, and documents a plaza-ID key for facilities including the Robert F. Kennedy Bridge, Bronx-Whitestone Bridge, Henry Hudson Bridge, Marine Parkway, Cross Bay, Queens Midtown Tunnel, Brooklyn-Battery Tunnel, Throgs Neck Bridge, and Verrazzano-Narrows Bridge. It says the dataset includes an Hour field, which is absent from the archived raw CSV.

#### Chemistry workshop PDF

`Workshop 03a - Topic 3_ Chemical Compounds .pdf` is a three-page General Chemistry 1 worksheet titled “Conversion Practice,” created 2026-09-13. It has no apparent Toll Shadow relationship. Keep it in a quarantine/review bucket until the archive owner confirms it can be removed.

#### Kepler screenshots

The three PNGs show the same general Kepler composition at different viewport sizes/zooms: a dark NYC-region basemap, traffic points colored by average 15-minute volume, MTA points colored by E-ZPass share, 12 congestion detection points, and a CBD taxi-zone layer. The screenshots are useful presentation references but contain no reproducible data or interaction state beyond what is separately embedded in `maps for the figma/01_Traffic.json`.

## Kepler Export

**File:** `maps for the figma/01_Traffic.json`

This is a valid Kepler.gl project export created 2026-09-15 at 15:22 EDT. It contains four embedded datasets and a saved configuration:

| Dataset label | Rows | Layer |
|---|---:|---|
| `MTA_Central_Business_District_Taxi_Zones_20260911.csv` | 38 | Polygon heatmap |
| `Automated_Traffic_Volume_Kepler_Clean_2024_2025.csv` | 2,559 | Point layer, colored by `avg_15min_volume` |
| `crz_kepler_detection_points.csv` | 12 | Heatmap |
| `MTA_Bridges_Tunnels_Kepler_2024_2025.csv` | 8,352 | Point layer, colored by `ezpass_share_pct` |

Saved map center is approximately latitude `40.7111`, longitude `-73.9655`, zoom `11.09`, 2D mode. There are no saved filters. The export is map-ready, but it does not include the raw DOT or raw MTA tables, disadvantaged-community GeoJSON, asthma table, or raster collection.

## Verified vs. Derived vs. Uncertain

### Preserve as source or source snapshot

- Raw DOT traffic CSV.
- Raw MTA traffic CSV.
- Raw-looking NYS asthma CSV.
- Asthma notes/data dictionary.
- `query.csv` taxi-zone PDF source snapshot.
- Both disadvantaged-community GeoJSON files.
- ArcInfo GRID components and all available metadata/sidecars.
- MTA overview PDF.

### Preserve as derived/map-ready products

- Clean DOT Kepler CSV.
- Clean MTA Kepler CSV.
- `crz_kepler_detection_points.csv`.
- `nyc_asthma_kepler.csv`.
- Taxi-zone WKT CSV.
- Kepler JSON export.
- PNG screenshots.

Each derived file needs a recorded recipe, input hashes, date, owner, and validation checks before it is treated as canonical.

### Quarantine for decision, not automatic deletion

- `Workshop 03a - Topic 3_ Chemical Compounds .pdf`: likely unrelated coursework.
- `org.apache.catalina.connector.RequestFacade@7e2236e5.csv`: likely a real source download, but the filename is not meaningful.
- `query.csv`: mislabeled but likely an important source snapshot; do not discard because of its extension.
- `.DS_Store` files: archive metadata/junk; removable only after confirming they have no intended role.
- Duplicate-looking raw/prepared traffic products: retain both until provenance and canonical-use decisions are recorded.

## Problems to Resolve Before Analysis or Cleanup

1. **Firebase project mismatch:** `.firebaserc` points to `tollshallows`; the intended active project is `tollshallow`.
2. **No deployed data path:** the singular Firebase Hosting site returned 404 and there is no backend implementation.
3. **Synthetic frontend demo:** the repository's current demo data must not be presented as measured findings.
4. **Raw MTA schema contradiction:** companion documentation says hourly data with an Hour field; the archived CSV has no Hour field and is named Daily.
5. **MTA ID mapping gap:** raw IDs `21`-`30` are not covered by the old PDF's facility key.
6. **Unknown DOT CRS:** raw WKT coordinates need a confirmed CRS before joins with GeoJSON or raster data.
7. **Prepared-table recipes missing:** policy cutoff, aggregation, outlier handling, observation thresholds, and estimated-hour formula are not included.
8. **Asthma temporal mismatch:** asthma data ends 2019 or earlier; it cannot be used as a 2025 treatment outcome without a new source.
9. **Asthma spatial mismatch:** prepared asthma points are borough centroids, not monitor locations or neighborhood estimates.
10. **Raster metadata gaps:** ten GRID directories lack `metadata.xml`; pollutant abbreviations, period numbering, and units need a codebook.
11. **Boundary provenance needs normalization:** the taxi-zone PDF has a source query URL, but the transformed CSV has no transformation record.
12. **Archive-level mixing:** unrelated coursework and generated screenshots sit beside project data with no separation.

## Recommended Organization Later

Do this only after the team confirms the canonical project root and desired Git/Firebase boundary. This is a proposed structure, not a change made during this audit:

```text
project/
  docs/
    project-context.md
    data-dictionary.md
    methods/
  data/
    raw/
      dot/
      mta/
      asthma/
      boundaries/
      air-quality-grid/
    processed/
      dot/
      mta/
      asthma/
      boundaries/
    derived/
      kepler/
      analysis/
  visualization/
    kepler-exports/
    screenshots/
  reference/
    source-documentation/
    quarantine/
  manifests/
    files.csv
    sources.yml
    transformations.yml
```

### Ordering rules

- Never overwrite raw downloads.
- Use stable, descriptive names only after recording the original filename.
- Keep one manifest row per file with original path, normalized path, byte size, SHA-256, acquisition date, source URL, scope, CRS, and status.
- Keep transformations as code or reproducible SQL/scripts, not only as exported CSVs.
- Keep screenshots and Kepler exports as presentation artifacts, not data sources.
- Keep archive-only or unrelated material in quarantine until a human confirms removal.
- Do not publish the full raw archive to Firebase Hosting. Publish only validated, purpose-built frontend assets or an API-backed subset.

## Analysis Guardrails

- Do not invent a winning neighborhood or claim the South Bronx, or any other location, as the answer before testing the data.
- Do not call the prepared before/after labels causal evidence. They are a comparison framing that needs a documented cutoff, controls, and confounder review.
- Traffic counts, bridge/tunnel counts, air-quality surfaces, disadvantaged-community indicators, and asthma outcomes have different time scales, spatial units, and measurement processes.
- Treat air-quality raster values as modeled/interpolated surfaces unless the metadata and source documentation establish otherwise.
- Treat the CRZ detection points as approximate aggregate markers, not exact sensor locations.
- Treat borough asthma data as historical county-level health statistics, not local sensor observations or a direct congestion-pricing outcome.
- Preserve units and NoData values; never coerce missing values to zero without a domain reason.
- Validate every spatial join for CRS, geometry validity, boundary scope, and one-to-many duplication.
- Keep weather, seasonality, fleet composition, construction, holidays, transit changes, and broader traffic trends in the confounder register.

## Next Work Sequence

1. Confirm the intended canonical repository and Firebase project (`tollshallow` versus the plural project).
2. Create a file manifest and source/provenance register without moving or deleting files.
3. Confirm raw DOT CRS and MTA plaza-ID mappings from authoritative source documentation.
4. Recover or write the transformation recipes for each prepared CSV.
5. Decide which air-quality GRID periods and pollutants are actually needed, then convert a copy to a web/analysis-friendly format with metadata preserved.
6. Separate unrelated/quarantine material after human confirmation.
7. Replace synthetic frontend data only after validated derived outputs exist.
8. Add tests for schema, row counts, date coverage, CRS, missing values, and no-synthetic-data guarantees.

## File Identity Checks

SHA-256 values for important prepared files:

```text
Automated_Traffic_Volume_Kepler_Clean_2024_2025.csv  b26a54b54bdc5bbd3c7cdac1b7631b0f698f02093c90220e3b84a8c0f1d0ee07
MTA_Bridges_Tunnels_Kepler_2024_2025.csv             e962afcb73e2e71d0e9e223f27e1602ecfd379697b978c8a2eef64884016b361
crz_kepler_detection_points.csv                      be8252795eb5d990000f89bab485c03c1a59bc33b05d4ea1896600b9dedacfbc
nyc_asthma_kepler.csv                                08adc80980f3eccb4799677b2becec01f4894e7321417811fae3637a260f65f3
MTA_Central_Business_District_Taxi_Zones_20260911.csv 8c1a59503676534ac4df90d8ef7c1ccd8db4b561edfd856d726d93b507c884ac
```

This document is the current orientation layer for the archive. It records what was observed, not a final scientific interpretation and not permission to remove anything.
