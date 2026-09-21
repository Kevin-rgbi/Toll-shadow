# Release Evidence

All commands below were run in the session that produced this document, from this repository root unless stated otherwise. Outputs are quoted as produced, including warnings.

## Release contents — `2026-09-18.1`

| Fact | Value |
|---|---|
| Release ID | `2026-09-18.1` |
| Schema version | `2.1.0` (adds `air_measurements` and CSV assets) |
| Transform version | `monthly-coverage-1.0.0` plus `supplied-kepler-derivative-1.0.0` for AIR |
| Status | `validated` |
| Release coverage | 2024-01-01 → 2026-09-17 |
| Policy reference date | 2025-01-05 (timeline marker only) |
| Source registers cited | `dot_automated_traffic_counts_archive_20260915`, `mta_crz_entries_2025_2026`, `mta_hourly_crossings_2025_2026`, `mta_cbd_geofence_20260916`, `nyccas_pm25_monitor_daily_2025_2026`, `nyccas_pm25_monitor_hourly_2025_2026` |

| Asset | Format | Bytes | SHA-256 |
|---|---|---:|---|
| `traffic_observations` | GeoJSON (EPSG:4326) | 2,082,788 | `c3baeeaff9799c77e5e26448a8d3723ac90b81106b1302fb2c03d6015fc92ab7` |
| `facility_crossings` | JSON | 157,586 | `d0fd3ec23a8a4b182372c905055dc75b4ad3c672f64d5fbcff2a6a095c31b774` |
| `crz_context` | JSON | 348,201 | `142ad78463811bf68ccc0ee387c49a48c4c9eaef1e824e6185e0bf34a099c3a4` |
| `boundary_zone` | GeoJSON (EPSG:4326) | 8,740 | `355362a4e69d68503706b577fa3cd0a660de181fcdebec257984222b443730dd` |
| `air_measurements` daily | CSV | 1,564,746 | `8c7ebc61df8bd095169556ec08fff7327089b86d8327e715dd7d80f0b1ffa4da` |
| `air_measurements` hourly | CSV | 41,705,713 | `096a22707d802294a5a8788440c25a36834729ae4d8d4e0c348e7f80007ca4f6` |

**Published traffic aggregates:** 2,561 point features covering 195 distinct street segments across 21 calendar months (2024-01 → 2025-12), split by day type and time band: 1,478 Weekday and 1,083 Weekend; roughly 510 in each of the five bands. A single month now carries up to 340 aggregates (2024-03), and 2025-12 carries 60. Months with no published rows: **2024-07, 2024-08, 2025-08** — the release publishes a gap rather than interpolating one.

A group is only published where the source contains observations for that segment, month, day type, and time band. Absent combinations are omitted rather than zero-filled, which is why the total is 2,561 rather than 195 × 21 × 10.

**Published facility crossings:** 8,352 daily rows across 464 distinct dates (2024-01-01 → 2025-04-12), plazas 21–30, directions `I` and `O`.

## Quality results

From the registered source checks and published parser results:

| Source | Rows inspected | Rows included | Rows rejected | Example rejection |
|---|---:|---:|---:|---|
| DOT traffic | 1,875,154 | 177,571 | 1 | `row 1367021: Vol must be an integer >= 0` |
| MTA crossings | 98,053 | 8,352 | 0 | — |

The one rejected DOT row is the archived negative-volume sentinel recorded in the source register as a known quality exception. Nothing was coerced to zero or dropped quietly.

## Verification commands and results

### Data pipeline and contracts

```text
$ npm run test
 Test Files  27 passed (27)
      Tests  173 passed (173)
```

The suite includes pipeline tests (contract validation, MTA/traffic parsers, geospatial checks, measure spec, source catalog) and frontend tests, including the module failure-state copy checks in `tests/frontend/moduleStates.test.ts`.

### Determinism

The published release is reproducible from its registered inputs. The browser-facing copies match the
manifest checksums, and the release acceptance gate verifies every declared asset:

```text
traffic_observations   MATCH
facility_crossings     MATCH
crz_context            MATCH
boundary_zone          MATCH
nyccas_pm25_daily      MATCH
nyccas_pm25_hourly     MATCH
```

The check was run against the built `dist/data` tree, so it did not modify the published release or the release pointer.

### Application

```text
$ npx tsc -b --pretty false
(no output, exit 0)

$ npm run lint
> eslint .
(no findings)

$ VITE_USE_DEMO_DATA=false npm run build
dist/index.html                                                         8.32 kB │ gzip:   2.44 kB
dist/assets/index-DwvIpg2a.css                                        117.35 kB │ gzip:   19.67 kB
dist/assets/index-C86UzIF2.js                                         324.24 kB │ gzip:   99.20 kB
dist/assets/MapShell-DzELj_Cj.js                                    1,066.58 kB │ gzip: 292.25 kB
✓ built in 323ms
(!) Some chunks are larger than 500 kB after minification.
(plus seven self-hosted woff2 font files, 152 kB total)
```

The >500 kB warning is the lazy-loaded MapLibre chunk, unchanged from the pre-implementation baseline. It is a known gap (see `KNOWN_GAPS.md`), not a regression.

### Deployment gate

```text
$ python3 scripts/release_acceptance.py
Release acceptance gate: /Users/kevinguillermo/Downloads/Toll-shadow-main/dist

49 checks passed, 0 failed

RELEASE ACCEPTED — proceed to the preview-channel runbook.
```

The gate blocks a candidate that is unbuilt, marked `synthetic: true`, unvalidated, missing release metadata, missing an asset checksum, shipping undeclared CSV or raw/archive payloads, over the browser-asset budget, carrying credentials, pointed at the wrong Firebase project, serving the release pointer with a cacheable lifetime, or publishing more than the one release the pointer serves. Each rejection path was exercised before being trusted, most recently the superseded-release check, which rejected a build carrying a stale release directory.

Built data payload for the release: **45,890,466 bytes** against the measured 64 MiB ceiling. The two NYCCAS CSVs are declared release assets and are checksum-verified before parsing.

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
200
```

`.firebaserc` was corrected from the plural `tollshallows` to the confirmed singular `tollshallow`.
Production serves the older verified `2026-09-16.2` release; the `2026-09-18.1` AIR candidate remains
local until it follows the preview runbook.

### Built preview verification (2026-09-18)

```text
$ npm run build
✓ built in 513ms

$ python3 scripts/release_acceptance.py --json
"passed": 49, "failed": 0
```

The candidate build serves the release pointer and all six assets from `dist/data`; the gate verifies
their checksums and the 45,890,466-byte payload. The prior production deployment remains release
`2026-09-16.2`; release `2026-09-18.1` has not been deployed.

Preview-served verification: the built shell and release pointer are reachable, the status strip is configured for
`RELEASE 2026-09-18.1 · VALIDATED`, and the AIR module is wired to load the daily monitor map and the
hourly CSV on demand. A browser console check remains part of the deployment runbook.


## Runtime claim enforcement (what a reviewer can verify in the browser)

- A release pointer that is missing, malformed, synthetic, or not `validated` produces a visible failure state; no fallback content is substituted.
- Each asset is fetched and its **SHA-256 is verified in the browser** against the manifest before parsing. A mismatch raises. This includes the daily and on-demand hourly NYCCAS CSVs.
- Malformed published rows raise: a coordinate swap, a negative volume, a non-integer count, a crossing total that disagrees with its components, or an E-ZPass share that does not reproduce its numerator/denominator.
- Selecting a month, borough, day type, or time band the release did not publish shows an explicit empty state reporting how many aggregates that month does hold, never another month's rows. A group that the source never observed is absent rather than zero-filled.
