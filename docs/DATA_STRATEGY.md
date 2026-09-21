# Data Strategy and Contract Plan

## Canonical lifecycle

```text
raw (immutable) -> staged (parsed) -> curated (normalized) -> published (small public assets)
                         |                  |                     |
                     schema checks       quality checks        manifest + provenance
```

Raw assets are never edited. Every non-raw output is reproducible from a named input version and a transformation version.

## Data domains and permitted Release 1 use

| Domain | Current archive asset | Release 1 use | Forbidden claim |
|---|---|---|---|
| DOT traffic | Raw 2000-2026 counts and 2024-2025 prepared aggregates | Observed traffic patterns, only after contract validation. | Causal policy impact or continuous/full-year traffic coverage. |
| MTA crossings | Raw 2010-2025 and prepared 2024-2025 facilities | Facility/direction observed comparison. | Hourly analysis from the daily aggregate table. |
| CRZ entries | 12 point summaries | Contextual entry-point totals with date window. | Exact detector location, payment/revenue, or route behavior proof. |
| DAC | 2023-era 1,736 feature statewide dataset and 958 NYC subset | Equity context with dataset version. | Current DAC status unless release is refreshed/confirmed. |
| NYCCAS | 88 ESRI GRID datasets, 2008-2019 modeled surfaces | Historical environmental context and metadata. | 2025 effect or localized regulatory measurement. |
| Asthma | NYS county/borough historical records through 2019 | Historical county-level context only. | Neighborhood or post-policy health outcome. |

## Required manifests

Create these in the implementation phase:

```text
data/catalog/sources.yaml                 # immutable source register
data/contracts/*.yaml                     # ODCS-inspired contracts per published domain
data/releases/<release_id>/manifest.json  # browser-facing release index
data/releases/<release_id>/quality.json   # check results and exceptions
data/releases/<release_id>/README.md      # human-readable changelog
```

Each source register entry must contain: `source_id`, original filename, acquisition timestamp, SHA-256, authoritative URL, agency/owner, license/status, geographic CRS, temporal coverage, grain, allowed uses, forbidden claims, and transformation inputs.

## Published-asset contract

Every browser-facing asset must declare:

```json
{
  "release_id": "2026-09-15.1",
  "schema_version": "1.0.0",
  "generated_at": "YYYY-MM-DDTHH:mm:ss.sssZ",
  "status": "validated",
  "source_ids": ["..."],
  "transform_version": "git-sha-or-semver",
  "coverage": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "policy_reference_date": "YYYY-MM-DD",
  "grain": "one row per ...",
  "geometry_crs": "EPSG:4326",
  "sha256": "...",
  "limitations": ["..."],
  "assets": [{
    "kind": "traffic_observations",
    "path": "/data/releases/<release_id>/asset.geojson",
    "format": "geojson",
    "bytes": 12345
  }]
}
```

`published` assets must be EPSG:4326 where they enter MapLibre. Internal source CRS is recorded, never silently assumed.
`kind` and `format` are required routing metadata: the browser must never infer which source-specific module owns an asset. `policy_reference_date`, when present, is a release-owned timeline marker only.

## Confirmed source facts

- The raw DOT `WktGeom` field is tied to the source `SegmentID`, a NYC LION street-network identifier. NYC Planning LION metadata specifies NAD83 / New York Long Island feet, **EPSG:2263**. The pipeline must transform it to EPSG:4326 and validate longitude/latitude bounds before publication.
- The archived MTA daily CSV is the NY Open Data daily aggregate view `fcbp-umit`, not the underlying hourly table. Its catalog definition groups records by date, plaza ID, and direction. Official metadata resolves IDs `21` through `30` and defines `I`/`O` direction semantics by facility; the parser must retain the source ID and never create an hour field.
- The archived NYS DAC layer is a 2023-era source version. It remains internal context until an owner chooses either a clearly labeled archived version or a refreshed Version 2.0 release.

## Quality gates

| Gate | Examples |
|---|---|
| Structural | expected columns, types, parsable dates, valid GeoJSON/JSON. |
| Semantic | non-negative vehicle counts, valid facility IDs, allowed category values, source coverage matches manifest. |
| Spatial | declared CRS, valid geometry, coordinate bounds, no accidental longitude/latitude swap. |
| Temporal | documented data window, no unsupported period comparison, no publication date treated as observation date. |
| Provenance | source URL, checksum, transformation version, and limitation text present. |
| Publication | asset-size budget, no raw/private fields, no `synthetic: true`, browser schema validation passes. |

## Data release policy

- A breaking field rename/type/semantic change increments `schema_version` major version.
- New optional fields increment minor version.
- Metadata-only corrections increment patch version.
- Failed quality checks block publication unless an exception is recorded in `quality.json` and visible to the reviewer.
- The released manifest is immutable; a correction creates a new release ID.

## Browser asset budget

**Agreed numbers** (Release 1, measured by `scripts/release_acceptance.py`, which fails the build when
any of them is exceeded). They existed only as "the agreed budget" before this table, which left the
PRD success metric unverifiable.

| Measure | Budget | Rationale |
|---|---:|---|
| Entry bundle, gzipped (JS + CSS) | 130 kB | The shell must paint before the map chunk is requested. |
| Lazy map chunk, gzipped | 330 kB | MapLibre dominates this and is loaded only when a map view opens. |
| Total published data assets in one release | 8 MiB | Six assets ship: two observed measures, one CRZ aggregate, and three context layers (modelled air surface, historical health, archived equity geography). The ceiling was raised from 6 MiB when the context layers landed, and the per-asset cap stays at 5 MiB. |
| Initial requests to first render | 12 | Fonts, shell, styles, manifest. |


- Do not ship raw CSV, original ESRI GRID components, or full statewide geometry without measurement.
- Publish pre-aggregated JSON/GeoJSON for the first release; simplify and split large geometry by layer.
- Add PMTiles/vector tiles only after a measured published layer exceeds the agreed performance budget or MapLibre profiling shows a real bottleneck.
- Load map data by URL and by selected module, never inline in application code.
