# Architecture: Static-First, Pipeline-Owned Evidence Product

## Decision

Release 1 uses a React/TypeScript/MapLibre SPA on Firebase Hosting, fed by versioned static public data assets built by a local/repository pipeline. Firebase is the delivery layer, not the data source of truth.

This preserves the existing React/Vite/MapLibre investment while removing synthetic analysis from the product path. It avoids premature Firebase database/functions complexity and makes every public number reproducible.

## System diagram

```text
                         +---------------------------+
                         | authoritative public data |
                         | MTA / DOT / NYS / NYC DOH |
                         +-------------+-------------+
                                       |
                                       v
                  +-----------------------------------------+
                  | data/raw (immutable + checksum catalog) |
                  +------------------+----------------------+ 
                                     |
                                     v
     +---------------------------------------------------------------+
     | pipeline: parse -> validate -> normalize -> aggregate -> export |
     | Python/DuckDB/geospatial tools, tests, contracts, reports       |
     +------------------+----------------------+---------------------+
                        |                      |
                        v                      v
            +---------------------+   +--------------------------+
            | data/releases/<id>/ |   | docs: methods/provenance |
            | manifest + assets   |   | quality + limitations    |
            +----------+----------+   +--------------------------+
                       |
                       v
      +----------------------------------------------+
      | React + TypeScript + MapLibre public SPA      |
      | Zod/TypeScript runtime validation, URL state  |
      +----------------------+-----------------------+
                             |
                             v
                    Firebase Hosting preview/live
```

## Components and responsibilities

| Component | Owns | Must not own |
|---|---|---|
| `data/raw/` | Original bytes and source metadata. | Edited/cleaned content. |
| `pipeline/` | Parsing, schema checks, transformations, release exports. | UI rendering or presentation copy. |
| `data/releases/` | Versioned public assets and release manifest. | Raw files or undocumented calculations. |
| `src/data/` | Runtime manifest validation and typed asset loading. | Data cleanup or hidden calculations. |
| `src/features/` | Product modules, maps, charts, interaction state. | Source-of-truth data definitions. |
| `src/components/` | Presentational UI. | Direct network access or domain calculations. |
| Firebase Hosting | Static SPA/assets, previews, cache headers, rollback. | Canonical records, transformation execution, secrets. |

## Target repository layout

```text
source/github-repo/
  data/
    catalog/  contracts/  raw/  releases/
  pipeline/
    src/  tests/  scripts/  fixtures/
  src/
    app/  data/  domain/  features/  components/  test/
  docs/
    PRD.md  DATA_STRATEGY.md  ARCHITECTURE.md  TECHNICAL_DESIGN_DOCUMENT.md
    decisions/  research/
  public/data/                    # generated, release-pinned copies only
  tests/
```

`public/data/manifest.json` remains the frontend entry point, but becomes a generated pointer to a validated release. It must never point at `demo/` in a production build.

## Key interfaces

### Frontend manifest

The frontend first fetches and validates a single release manifest. The manifest includes asset URLs, schema versions, coverage, source IDs, checksums, status, and limitation keys. The application refuses an invalid or synthetic production release.

### Domain adapters

Each source-specific adapter produces a small canonical domain model. Examples:

- `TrafficObservation`: location, observed period, direction, measure, sample size, source ID, geometry.
- `FacilityCrossing`: facility, direction, period, vehicle totals, E-ZPass share, source ID.
- `ContextArea`: geometry, context indicator, release/version, scope, source ID.

No UI component reads raw-source field names such as `Vol`, `Boro`, or `aaRate10K` directly.

## Deployment architecture

- Use the confirmed singular Firebase project only after project ownership and `.firebaserc` are corrected in a reviewed implementation step.
- Use Hosting preview channels for every candidate release.
- Cache immutable release assets by release ID; cache the top-level manifest briefly/no-cache so new releases are discovered.
- Add a server/backend only when a documented requirement cannot be met by static assets: secure data, frequent refresh requiring server scheduling, complex query API, or write/auth workflow.

## Architecture constraints

- No secret/API key in frontend code or release assets.
- No database is introduced by default.
- No dynamic “expected” values until a reviewed analysis design and its tests exist.
- No direct rendering of 300 MB raw traffic or 332 MB raster archives.
