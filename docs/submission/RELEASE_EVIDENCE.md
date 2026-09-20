# Release Evidence

All commands below were run in the session that produced this document, from `source/github-repo/` unless stated otherwise. Outputs are quoted as produced, including warnings.

## Release contents — `2026-09-16.2`

| Fact | Value |
|---|---|
| Release ID | `2026-09-16.2` |
| Schema version | `1.1.0` (adds the `day_type` and `time_band` dimensions) |
| Transform version | `pipeline-release-1.1.0` |
| Status | `validated` |
| Release coverage | 2024-01-01 → 2025-12-31 |
| Policy reference date | 2025-01-05 (timeline marker only) |
| Source registers cited | `dot_automated_traffic_counts_archive_20260915`, `mta_daily_bridge_tunnel_traffic_archive_20260915` |

| Asset | Format | Bytes | SHA-256 |
|---|---|---:|---|
| `traffic_observations` | GeoJSON (EPSG:4326) | 2,082,788 | `c3baeeaff9799c77e5e26448a8d3723ac90b81106b1302fb2c03d6015fc92ab7` |
| `facility_crossings` | JSON | 2,890,818 | `e412c3168de14ec1a0597d8a5f11d0f5ad59d66cc2014c71eaba11f78afc8f44` |

**Published traffic aggregates:** 2,561 point features covering 195 distinct street segments across 21 calendar months (2024-01 → 2025-12), split by day type and time band: 1,478 Weekday and 1,083 Weekend; roughly 510 in each of the five bands. A single month now carries up to 340 aggregates (2024-03), and 2025-12 carries 60. Months with no published rows: **2024-07, 2024-08, 2025-08** — the release publishes a gap rather than interpolating one.

A group is only published where the source contains observations for that segment, month, day type, and time band. Absent combinations are omitted rather than zero-filled, which is why the total is 2,561 rather than 195 × 21 × 10.

**Published facility crossings:** 8,352 daily rows across 464 distinct dates (2024-01-01 → 2025-04-12), plazas 21–30, directions `I` and `O`.

## Quality results

From `data/releases/2026-09-16.2/quality.json`:

| Source | Rows inspected | Rows included | Rows rejected | Example rejection |
|---|---:|---:|---:|---|
| DOT traffic | 1,875,154 | 177,571 | 1 | `row 1367021: Vol must be an integer >= 0` |
| MTA crossings | 98,053 | 8,352 | 0 | — |

The one rejected DOT row is the archived negative-volume sentinel recorded in the source register as a known quality exception. Nothing was coerced to zero or dropped quietly.

## Verification commands and results

### Data pipeline and contracts

```text
$ npm run test
 Test Files  22 passed (22)
      Tests  130 passed (130)
```

The suite includes pipeline tests (contract validation, MTA/traffic parsers, geospatial checks, measure spec, source catalog) and frontend tests, including the module failure-state copy checks in `tests/frontend/moduleStates.test.ts`.

### Determinism

The published release is reproducible from its registered raw inputs. Rebuilding with the published
release ID and generation timestamp into a temporary output directory produced assets identical to
the published ones, and identical quality counts:

```text
traffic_observations   IDENTICAL
facility_crossings     IDENTICAL
features: 2 | DOT included: 177571 | invalid: 1
```

The check was run with `buildRelease` pointed at temporary `releaseRoot`/`publicDataRoot`
directories, so it did not modify the published release or the release pointer.

### Application

```text
$ npx tsc -b --pretty false
(no output, exit 0)

$ npm run lint
> eslint .
(no findings)

$ npm run build
dist/index.html                                                         0.74 kB │ gzip:   0.43 kB
dist/assets/index-0cgNLJ_D.css                                        106.69 kB │ gzip:  17.89 kB
dist/assets/index-sJLudOuf.js                                         273.84 kB │ gzip:  84.12 kB
dist/assets/MapShell-Bhi_Ml2F.js                                    1,055.77 kB │ gzip: 288.89 kB
✓ built in 234ms
(!) Some chunks are larger than 500 kB after minification.
(plus seven self-hosted woff2 font files, 152 kB total)
```

The >500 kB warning is the lazy-loaded MapLibre chunk, unchanged from the pre-implementation baseline. It is a known gap (see `KNOWN_GAPS.md`), not a regression.

### Deployment gate

```text
$ python3 scripts/release_acceptance.py
Release acceptance gate: .../source/github-repo/dist

36 checks passed, 0 failed

RELEASE ACCEPTED — proceed to the preview-channel runbook.
```

The gate blocks a candidate that is unbuilt, marked `synthetic: true`, unvalidated, missing release metadata, missing an asset checksum, shipping raw/archive payloads, over the browser-asset budget, carrying credentials, pointed at the wrong Firebase project, serving the release pointer with a cacheable lifetime, or publishing more than the one release the pointer serves. Each rejection path was exercised before being trusted, most recently the superseded-release check, which rejected a build carrying a stale `2026-09-16.1` directory.

Built data payload for the release: **4,978,982 bytes** against the gate's 8 MiB provisional ceiling. It was 8,101,496 bytes before the superseded release was unpublished.

### Kepler reproducibility artifact

```text
$ python3 visualization/kepler/validate_kepler_export.py
34 checks passed, 0 failed

Claim boundary: A passing comparison means only that the embedded export matches these declared
legacy inputs by identity, row count, schema, and value. It does not mean the inputs are
analytically approved, that the policy labels/formulas are documented, or that any measure is causal.
```

The validator is not vacuous: against a deliberately tampered copy (one value changed, one row dropped, one field dropped) it reported 5 failures and exited 1.

### Firebase target

```text
$ npx firebase projects:list
│ Project Display Name │ Project ID  │ Project Number │
│ TollShallow          │ tollshallow │ 1094344081770  │
1 project(s) total.

$ npx firebase hosting:sites:list --project tollshallow
│ Site ID     │ Default URL                │
│ tollshallow │ https://tollshallow.web.app │

$ npx firebase hosting:sites:list --project tollshallows
Error: ... HTTP Error: 403, The caller does not have permission

$ curl -o /dev/null -w "%{http_code}" https://tollshallow.web.app/
200   (was 404 before the production deploy below)
```

`.firebaserc` was corrected from the plural `tollshallows` to the confirmed singular `tollshallow`.

### Production deployment (2026-09-16)

```text
$ curl https://tollshallow.web.app/                          HTTP 200, text/html
$ curl https://tollshallow.web.app/data/manifest.json        release 2026-09-16.2, validated, 2 assets
$ curl .../data/releases/2026-09-16.2/traffic_observations.geojson | sha256sum
  c3baeeaff9799c77e5e26448a8d3723ac90b81106b1302fb2c03d6015fc92ab7   (matches the manifest)
```

Cache headers in production: `/` and `/data/manifest.json` return
`no-cache, max-age=0, must-revalidate`; `/data/releases/**` returns
`public, max-age=31536000, immutable`.

Browser-verified in production: the shell renders, the build stamp reads `20260916-1018-d8a1e1e`, the
status strip reads `RELEASE 2026-09-16.2 · VALIDATED`, the TRAFFIC module reports "Showing 45 of 340
published aggregates for 2024-03" when driven by URL filters, the WebGL-free map draws 60 points over
108 raster tiles, and the console reports zero errors.


## Runtime claim enforcement (what a reviewer can verify in the browser)

- A release pointer that is missing, malformed, synthetic, or not `validated` produces a visible failure state; no fallback content is substituted.
- Each asset is fetched and its **SHA-256 is verified in the browser** against the manifest before parsing. A mismatch raises.
- Malformed published rows raise: a coordinate swap, a negative volume, a non-integer count, a crossing total that disagrees with its components, or an E-ZPass share that does not reproduce its numerator/denominator.
- Selecting a month, borough, day type, or time band the release did not publish shows an explicit empty state reporting how many aggregates that month does hold, never another month's rows. A group that the source never observed is absent rather than zero-filled.
