# Release Evidence

Release `2026-09-21.1` figures were produced and deployed on **2026-09-21**.
The earlier `2026-09-20.5` deployment record remains below as historical evidence.

## Release contents — `2026-09-21.1`

| Fact | Value |
|---|---|
| Schema / transform | `2.1.0` / `unified-air-traffic-2.0.0` |
| Status | `validated`, live at <https://tollshallows.web.app> |
| Release coverage | 2024-01-01 → 2026-09-21 |
| Published assets | 8 |
| Payload | 54,752,645 bytes (about 52.2 MiB) |

| Asset | Coverage | Bytes |
|---|---|---:|
| Sampled DOT traffic | 2024-01-01 → 2026-02-03 | 1,502,491 |
| MTA facility crossings | 2025-01-01 → 2026-09-08 | 4,165,864 |
| CRZ entry context | 2025-01-05 → 2026-09-12 | 66,535 |
| NYCCAS PM2.5 daily | 2024-12-31 local date → 2026-09-20 local date | 1,540,151 |
| NYCCAS PM2.5 hourly | 2025-01-01 00:00 UTC → 2026-09-21 00:00 UTC | 46,933,880 |
| Historical air / health / equity | dated context retained from `2026-09-20.5` | 543,724 |

Quality evidence: 1,875,154 DOT rows inspected (186,691 included, one negative sentinel rejected);
2,939,033 official crossing rows represented by 23,397 server aggregates and 11,699 published daily
facility/direction rows; 6,386,688 CRZ rows represented by 252 month/group aggregates; and 198,205
NYCCAS observations represented by 217,872 active station-hours, including 19,667 explicit null gaps.
There are no duplicate NYCCAS site-hours. Daily PM2.5 uses New York calendar days, including 23/25
hour DST days, and withholds one relocation-day mean.

Reproduction commands:

```sh
node pipeline/scripts/fetch-official-traffic-snapshots.mjs
node pipeline/scripts/build-unified-release.mjs \
  --air-archive /path/to/nyccas-data-main.zip \
  --dot-input /path/to/Automated_Traffic_Volume_Counts_20260921.csv
```

## Deployment verification — `2026-09-21.1`

| Fact | Verified value |
|---|---|
| Git commit deployed | `ff01e4f` |
| Firebase project / site | `tollshallows` / <https://tollshallows.web.app> |
| Preview channel | `release-2026-09-21-1`, verified before promotion |
| Live manifest | `release_id: 2026-09-21.1`, `status: validated`, 8 assets |
| Browser smoke suite against production | 63 passed, 3 expected desktop skips |
| Root and manifest cache | `no-cache, max-age=0, must-revalidate` |
| Versioned data and hashed bundle cache | `max-age=31536000, immutable` |
| Live hourly AIR checksum | `40c568146d1c6e41646654e4d8d108f67698e31008c2ea4490261aea0853d380` |

The live root, manifest, hashed JavaScript, and hourly AIR asset returned HTTP 200 after promotion.
The shell exposed the plural canonical URL, and the full desktop/mobile Playwright suite ran directly
against production rather than only against the local build.

---

## Historical deployed release — `2026-09-20.5`

| Fact | Value |
|---|---|
| Release ID | `2026-09-20.5` |
| Schema version | `1.4.0` |
| Transform version | `pipeline-release-1.4.0` |

| Status | `validated` |
| Release coverage | 2024-01-01 → 2025-12-31 |
| Policy reference date | 2025-01-05 (timeline marker only) |
| Published assets | 6 |
| Payload | 6.02 MiB of the 64 MiB merged gate ceiling |
| Source registers cited | `dot_automated_traffic_counts_archive_20260915`, `mta_daily_bridge_tunnel_traffic_archive_20260915`, `mta_crz_entries_archive_20260920`, `nyccas_air_context_derived_2016`, `nys_asthma_context_derived_historical`, `nyc_dac_context_derived_2023` |

| Asset | Path | Format | Bytes | SHA-256 |
|---|---|---|---:|---|
| `traffic_observations` | `traffic_observations.geojson` | GeoJSON (EPSG:4326) | 2,082,788 | `c3baeeaff9799c77e5e26448a8d3723ac90b81106b1302fb2c03d6015fc92ab7` |
| `facility_crossings` | `facility_crossings.json` | JSON | 3,596,098 | `b39cb694bd8f98f0ef3a2dfb844dd55fdf1a18b83794b4b0a20c2fa39f4452a8` |
| `crz_context` | `crz_entry_summary.json` | JSON | 85,191 | `2b0f37d2a57975ea3068668f7a7212efdd6a2d982cead979215f685d04da1372` |
| `historical_context` | `air_context.json` | JSON | 34,186 | `51bd201f71dcad62a878a49c61432a6faffcac6f1a705f823c95d145813b8b97` |
| `health_context` | `health_context.json` | JSON | 28,287 | `770554d942def23710a4de899f220ff221d5ff969a47a8013d815933bb022097` |
| `dac_context` | `equity_context.geojson` | GeoJSON | 481,251 | `e27c3f063511107c0b0a0ada77a7e31a1d0b98f97c7b066cd00157faadeba16e` |

Published releases are immutable. `2026-09-20.5` supersedes `2026-09-20.4` to publish each asset's
authoritative source URL, which the PRD requires every module to expose and which no earlier release
carried. It publishes the **same six assets with identical checksums** (verified: 6/6), which is what
makes it a metadata correction rather than a data change. Superseded releases go out of service with
the deploy; their canonical copies stay under `data/releases/`.

## Quality results

From `data/releases/2026-09-20.5/quality.json`:


| Source | Rows inspected | Rows included | Rows rejected | Example rejection |
|---|---:|---:|---:|---|
| DOT traffic | 1,875,154 | 177,571 | 1 | `row 1367021: Vol must be an integer >= 0` |
| MTA crossings | 98,053 | 8,352 | 0 | — |
| CRZ aggregates | 252 | 252 | 0 | — |
| NYCCAS modelled surface | 2,607 | 2,607 | 0 | — |
| NYS asthma context | 132 | 132 | 0 | — |
| NYC disadvantaged-communities context | 958 | 958 | 0 | — |

## Verification commands and results

### Data pipeline and contracts


```
$ npx vitest run pipeline/tests
Test Files  8 passed (8)      Tests  38 passed (38)
$ node pipeline/scripts/validate-source-catalog.mjs     # 17 sources, all checksums match
```

### Determinism

Two independent builds of the same inputs at the same timestamp produce byte-identical assets. This
was checked by pointing the measure specification at a scratch release ID, building it, and comparing
the six payload files:

```
byte-identical assets across two independent builds: 6/6
```

The builder also refuses a release ID that disagrees with the measure specification (`release_id
2026-09-20.99 does not match measure specification`), and refuses to overwrite an existing release
directory (`EEXIST`) — both observed while setting the check up.

### Application

```
$ npx tsc -b                # clean
$ npm run lint              # clean
$ npm run test              # Test Files 32 passed (32)      Tests 220 passed (220)
$ npm run test:e2e          # 59 passed, 3 skipped (desktop and phone viewports)
$ VITE_USE_DEMO_DATA=false npm run build
                            # entry 325 kB raw / 100 kB gzip; map chunk 1,065 kB raw / 292 kB gzip

```

The unit suite includes the accessibility gate (axe over nine surfaces, zero serious or critical
violations, plus a negative test that the gate is not vacuous) and the source-size ratchet.

The end-to-end suite runs against the built site served by `vite preview`, not the dev server. It found
two production defects on its first run, both fixed and recorded in the commit history: the historical
health context rejected its own asset because a rate per 10,000 head was validated as a whole count, and
a module reported "this release does not publish that asset" when the manifest itself had failed to load.

### Deployment gate

```
$ python3 scripts/release_acceptance.py
60 checks passed, 0 failed
RELEASE ACCEPTED — proceed to the preview-channel runbook.
```

The gate rejects a candidate that is unbuilt, marked `synthetic: true`, unvalidated, missing release
metadata, missing an asset checksum, shipping raw/archive payloads, over the browser-asset budget,
carrying credentials, pointed at the wrong Firebase project, serving the release pointer with a
cacheable lifetime, or publishing more than the one release the pointer serves. It also asserts the
security headers and the cache rules.


### Kepler reproducibility artifact

```
$ python3 visualization/kepler/validate_kepler_export.py
34 checks passed, 0 failed
```

Previously this reported 18 passed and 4 failed: the validator resolved its workspace root one level too
shallow, so the four identity checks that compare the export against its declared source CSVs never ran.
The merged validator now checks the declared workspace paths and the retained `data/reference-legacy/`
copies, then verifies SHA-256, header, row count, and embedded values.

### Firebase target

Verified live after the deploy, on 2026-09-20:

```
$ curl -s https://tollshallow.web.app/data/manifest.json       release 2026-09-20.5, validated, 6 assets
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.5/equity_context.geojson     200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.5/health_context.json        200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.5/air_context.json           200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.5/crz_entry_summary.json     200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.4/equity_context.geojson     404   # superseded
```

Every asset in the live manifest carries one `source_urls` entry, and every module renders it. Read
live from the deployed build:

| Module | Source link rendered |
|---|---|
| TRAFFIC | `data.cityofnewyork.us/Transportation/Automated-Traffic-Volume-…` |
| CROSSINGS | `data.ny.gov/Transportation/Daily-Traffic-on-MTA-Bridges-Tunnels/…` |
| CRZ | `data.ny.gov/Transportation/MTA-Congestion-Relief-Zone-Vehicle-Entries-…` |
| AIR | `data.cityofnewyork.us/Environment/NYCCAS-Air-Pollution-Rasters/…` |
| EQUITY | `data.ny.gov/Environmental-Conservation/Disadvantaged-Communities/…` |

The shell describes the release it serves: `index.html` contains no reference to a superseded release,
and its `Dataset` structured data lists **6 distributions and 6 sources**, generated at build time from
the manifest rather than written by hand.

### Rendered in a browser, on the deployed build

Checked against production after the deploy, build stamp `20260920-2046-4be551d`:

| Module | Observed |
|---|---|
| EQUITY | 958 tract paths drawn, 5 counties, no failure state |
| AIR | canvas painted at 42,763 opaque pixels; health records listed; no failure state |
| TRAFFIC | count line and filters populated from published aggregates |
| CROSSINGS | 8,352 published daily rows, **named** plazas, window stated |
| CRZ | 12 detection groups, 21 published months, areas-not-points caveat |

### Rollback


Rehearsed on preview channel `p10-rehearsal` on 2026-09-20, production untouched. The rehearsal found
that two commands the runbook documented do not exist in firebase-tools 15.30 and that there is no CLI
rollback command in that version. The runbook now records the working commands and the observed
behaviour: `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md`.

## Runtime claim enforcement (what a reviewer can verify in the browser)

- A manifest that is missing, malformed, or not `validated` renders a failure state and **no figures**.
- Every module shows `Source and method` with coverage, grain, transform version, checksum, and the
  asset's own limitations.
- No page text claims synthetic values: the dev control surface is absent from a production build, and
  an end-to-end test asserts it.
- The build stamp in the masthead names the exact build the browser is running; a link from a different
  build reports the staleness instead of failing silently.
- `?module=`, `?borough=`, `?day=`, `?band=`, `?date=`, and `?v=` are all round-tripped, so a reviewer
  can be sent the exact view being discussed.
