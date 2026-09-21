# Release Evidence

Every figure below was produced on **2026-09-20** in the session that published this release, by the
command named next to it. Nothing here is carried forward from an earlier revision of this document.

## Release contents — `2026-09-20.4`

| Fact | Value |
|---|---|
| Release ID | `2026-09-20.4` |
| Schema version | `1.4.0` |
| Transform version | `pipeline-release-1.4.0` |
| Status | `validated` |
| Release coverage | 2024-01-01 → 2025-12-31 |
| Policy reference date | 2025-01-05 (timeline marker only) |
| Published assets | 6 |
| Payload | 6.02 MiB of the 8 MiB gate ceiling |
| Source registers cited | `dot_automated_traffic_counts_archive_20260915`, `mta_daily_bridge_tunnel_traffic_archive_20260915`, `mta_crz_entries_archive_20260920`, `nyccas_air_context_derived_2016`, `nys_asthma_context_derived_historical`, `nyc_dac_context_derived_2023` |

| Asset | Path | Format | Bytes | SHA-256 |
|---|---|---|---:|---|
| `traffic_observations` | `traffic_observations.geojson` | GeoJSON (EPSG:4326) | 2,082,788 | `c3baeeaff9799c77e5e26448a8d3723ac90b81106b1302fb2c03d6015fc92ab7` |
| `facility_crossings` | `facility_crossings.json` | JSON | 3,596,098 | `b39cb694bd8f98f0ef3a2dfb844dd55fdf1a18b83794b4b0a20c2fa39f4452a8` |
| `crz_context` | `crz_entry_summary.json` | JSON | 85,191 | `2b0f37d2a57975ea3068668f7a7212efdd6a2d982cead979215f685d04da1372` |
| `historical_context` | `air_context.json` | JSON | 34,186 | `51bd201f71dcad62a878a49c61432a6faffcac6f1a705f823c95d145813b8b97` |
| `health_context` | `health_context.json` | JSON | 28,287 | `770554d942def23710a4de899f220ff221d5ff969a47a8013d815933bb022097` |
| `dac_context` | `equity_context.geojson` | GeoJSON | 481,251 | `e27c3f063511107c0b0a0ada77a7e31a1d0b98f97c7b066cd00157faadeba16e` |

Published releases are immutable. `2026-09-20.4` supersedes `2026-09-20.3` to correct the release's own
documentation — its README omitted three of the six sources from its quality summary — and it publishes
the **same six assets with identical checksums**, which is what makes that a documentation correction
rather than a data change. `2026-09-20.3` went out of service with this deploy; its canonical copy stays
under `data/releases/`.

## Quality results

From `data/releases/2026-09-20.4/quality.json`:

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
Test Files  6 passed (6)      Tests  17 passed (17)
$ node pipeline/scripts/validate-source-catalog.mjs     # 15 sources, all checksums match
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
$ npm run test              # Test Files 26 passed (26)      Tests 166 passed (166)
$ npm run test:e2e          # 59 passed, 3 skipped (desktop and phone viewports)
$ npm run build             # main 288 kB raw / 87 kB gzip; map chunk 1,035 kB raw / 279 kB gzip
```

The unit suite includes the accessibility gate (axe over eight surfaces, zero serious or critical
violations, plus a negative test proving axe reports real violations) and the source-size ratchet.

The end-to-end suite runs against the built site served by `vite preview`, not the dev server. It found
two production defects on its first run, both fixed and recorded in the commit history: the historical
health context rejected its own asset because a rate per 10,000 head was validated as a whole count, and
a module reported "this release does not publish that asset" when the manifest itself had failed to load.

### Deployment gate

```
$ python3 scripts/release_acceptance.py
47 checks passed, 0 failed
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
A checkout that carries no workspace data now reports those four as **skipped with a reason** rather
than passing or failing a check it cannot run.

### Firebase target

Verified live: `https://tollshallow.web.app` serves release `2026-09-20.4`, `status: validated`, six
assets:

```
$ curl -s https://tollshallow.web.app/data/manifest.json       release 2026-09-20.4, validated, 6 assets
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.4/equity_context.geojson     200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.4/health_context.json        200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.4/air_context.json           200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.4/crz_entry_summary.json     200
$ curl -so /dev/null -w '%{http_code}\n' .../2026-09-20.3/equity_context.geojson     404   # superseded
```

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
