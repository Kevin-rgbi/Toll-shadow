# The Toll Shadow

A source-backed evidence explorer for New York City traffic observations around the Congestion Relief
Zone. It shows what a published data release measures, over which window, from which source, and with
which stated limits.

**It does not publish a counterfactual, a causal policy estimate, a regulatory AQI claim,
or a post-2025 health outcome.**

**Live:** <https://tollshallow.web.app> (previous deployment) · **Release under review:** `2026-09-21.1` (not deployed)

---

## Status: a complete Release 1 slice, not the whole project

This build does what Release 1 asked for and states what it still does not do. Read both lists.

**Shipped, with published data and a link to the source for every figure:**

- Eight published assets from seven registered sources, served by the app: sampled traffic
  observations, MTA facility crossings, CRZ entry aggregates, daily and hourly NYCCAS PM2.5,
  a modelled historical air surface, historical asthma context, and archived equity geography.
- Six evidence modules: **TRAFFIC**, **CROSSINGS**, **CRZ**, **AIR**, **EQUITY**, and **SOURCES**.
  Every module shows source URL, coverage window, grain, transform version, checksum, and the asset's
  own limitations.
- The browser verifies each asset's SHA-256 against the release manifest before parsing it. A missing,
  malformed, or unvalidated manifest renders a failure state and no figures.
- Filters, a shared timeline, keyboard navigation, reduced-motion support, and shareable URL state.
- Map: MapLibre with OpenStreetMap tiles, plus a WebGL-free raster map for browsers without a WebGL2
  context (`?map=software` forces it, `?map=gpu` forces the attempt).
- Automated accessibility gate, a browser end-to-end suite, and CI running the gate, the suites, and
  the size ratchet on every push.

**Not finished, and not hidden:**

- **CBD taxi-zone boundary** is not published. Its source is registered and it is the next candidate.
- **MTA facility points and the CRZ detection points** are blocked on a provenance decision, not on
  code: their coordinates exist only in a legacy derivative whose transformation recipe was never
  recorded.
- **Published traffic points remain view-only.** PM2.5 monitor points in AIR and STORY are selectable
  and expose the recorded value, coverage, and missing state; the generic traffic layer does not yet
  have an equivalent inspection card.
- **`CONFIDENCE` and `HOTSPOTS`** render only under the development flag: a confidence composition and
  a hotspot ranking both imply an inference this data cannot support.
- **No uptime or error monitoring**, and **no independent human review** of the code or the data. Both
  are recorded owner decisions.
- **The historical raster/equity derivations cannot be re-run here** (`rasterio` and `shapely` are not
  installed). The new measured-air and traffic recipes do run here using Python's standard library
  and Node.
- Development-labelled strings remain in components that ship, in development-guarded branches. The
  prototype modules themselves are absent from the production bundle; the strings are not.
- Nothing here is a final visual brand direction; the interface is a deliberate editorial pass.

`docs/submission/KNOWN_GAPS.md` states all of this at length, and
`docs/submission/TRACEABILITY.md` maps every Release 1 requirement to the test or release check that
proves it.

## Data used, and where it comes from

**Raw source files are not in this repository.** They total ~321 MB. Every source is registered with
its authoritative URL, SHA-256, coverage, grain, CRS, and its allowed and forbidden uses:

- `data/catalog/sources.yaml` — the source register (20 sources)
- `data/README.md` — how to obtain the raw files and reproduce the release

Seven of those entries feed the published release:

| Source | Publisher | Published as | Coverage | Window |
|---|---|---|---|---|
| `dot_automated_traffic_counts_archive_20260915` | NYC DOT (`7ym2-wayt`) | `traffic_observations` | 2024-01-01 → 2026-02-03 | 186,691 included observations |
| `mta_hourly_crossings_archive_20260921` | MTA (`ebfx-2m7v`) | `facility_crossings` | 2025-01-01 → 2026-09-08 | 11,699 daily facility/direction rows |
| `mta_crz_entries_archive_20260921` | MTA (`t6yz-b64h`) | `crz_context` | 2025-01-05 → 2026-09-12 | 252 monthly aggregates |
| `nyccas_pm25_archive_20260921` | NYC DOHMH / NYCCAS | `air_measurements` | 2025-01-01 00:00 UTC → 2026-09-21 00:00 UTC | 198,205 observed hours plus explicit gaps |
| `nyccas_air_context_derived_2016` | NYC Community Air Survey (derived here) | `historical_context` | 2016 | 78×78 relative grid |
| `nys_asthma_context_derived_historical` | NYS Department of Health (archived) | `health_context` | 2000 → 2019 | 132 records |
| `nyc_dac_context_derived_2023` | NYS Climate Justice WG / NYSERDA (archived) | `dac_context` | 2023 | 958 census tracts |

The three `*_derived_*` sources publish a recorded recipe next to their register entry, in
`pipeline/scripts/`. That matters because the older Kepler-era derivatives could not be reproduced from
anything in the repository, which is why they are no longer release inputs.

Published release outputs **are** committed, so the data actually shipped can be inspected directly:

```
data/releases/2026-09-21.1/
  manifest.json                 assets, checksums, source URLs, coverage, grain, limitations
  quality.json                  rows inspected / included / rejected per source
  README.md                     human-readable changelog with a source URL per asset
  traffic_observations.geojson  1,502,491 bytes, EPSG:4326
  facility_crossings.json       4,165,864 bytes
  crz_entry_summary.json           66,535 bytes
  nyccas_pm25_daily.csv         1,540,151 bytes
  nyccas_pm25_hourly.csv       46,933,880 bytes, loaded on demand
  air_context.json                 34,186 bytes
  health_context.json              28,287 bytes
  equity_context.geojson          481,251 bytes
public/data/manifest.json       the pointer the app fetches, generated by the build
public/data/releases/...        the browser-facing copy of the above
```

Canonical copies of past releases stay under `data/releases/`; the production build prunes
browser-facing release directories except the one named by the `2026-09-21.1` pointer.

What the pipeline actually did with the raw files:

| Source | Inspected | Included | Rejected | Result |
|---|---:|---:|---:|---|
| NYC DOT automated traffic counts | 1,875,154 | 186,691 | 1 | sampled segment/month aggregates |
| MTA hourly bridge and tunnel traffic | 2,939,033 | 2,939,033 | 0 | 11,699 daily facility/direction rows |
| MTA CRZ ten-minute entries | 6,386,688 | 6,386,688 | 0 | 252 monthly group rows |
| NYCCAS PM2.5 observations | 198,205 | 198,205 | 0 duplicates | 217,872 station-hours including 19,667 null gaps |
| NYCCAS modelled surface | 2,607 | 2,607 | 0 | 78×78 grid |
| NYS asthma context | 132 | 132 | 0 | 132 records |
| NYC disadvantaged-communities context | 958 | 958 | 0 | 958 tracts |

The single rejected DOT row is the archived negative-volume sentinel (`Vol = -1`); it is rejected and
reported, never coerced to zero. Rows outside the 2024-01-01 through 2026-02-03 publication window are
excluded by the declared coverage, which is why 1.87M source rows produce 186,691 included rows.

## Pipeline

```
raw CSV / archive -> contract validation -> aggregation or derivation -> release assets + manifest + quality report
```

- `pipeline/src/` — CSV contract reader, traffic, MTA, CRZ and context adapters, geospatial transform
  (EPSG:2263 to EPSG:4326), measure-spec validation, context validators, release builder
- `pipeline/scripts/` — reproducible measured-air derivation, paginated MTA snapshot retrieval, and
  the recorded historical air, health, and equity recipes
- `pipeline/methods/release-1.yaml` — the approved measure spec: six descriptive measures with their
  numerators, denominators, aggregation, inclusion and exclusion rules, and the one excluded asset kind
  with its reason
- `data/contracts/*.yaml` — one contract per published domain plus the release-manifest contract, which
  `pipeline/tests/contracts.test.mjs` enforces against the manifest that actually publishes
- `pipeline/tests/` — fixtures and tests, including the negative cases (unknown plaza, negative volume,
  fractional event count, malformed geometry, unregistered source URL)
- `scripts/release_acceptance.py` — the deployment gate for checksums, provenance, payloads, metadata,
  security headers, caching, and release isolation

Reproduce the release (see `data/README.md` for source checksums):

```bash
node pipeline/scripts/fetch-official-traffic-snapshots.mjs
node pipeline/scripts/build-unified-release.mjs \
  --air-archive /path/to/nyccas-data-main.zip \
  --dot-input /path/to/Automated_Traffic_Volume_Counts_20260921.csv
python3 scripts/release_acceptance.py
```

The builder refuses a release ID that disagrees with the measure spec, refuses to overwrite an existing
release directory, and refuses to publish an asset whose source has no registered URL. Rebuilding the
published release ID from the same inputs reproduces the published assets **byte for byte** (verified
against the SHA-256 values in the release manifest).

## Application

React + TypeScript + MapLibre, static-first.

```
src/app/          shell: masthead, mode tabs, figures strip, map column, data rail
src/features/     evidence modules (traffic, crossings, crz, air, equity) and their aggregation logic
src/lib/          release manifest contract, asset parsers, view state, build identity
src/components/   map (MapShell + its lifecycle, layer and drawing hooks), provenance, story, status
src/dev/          development-only panels, loaded behind a flag the bundler can drop
src/styles/       the stylesheet, split by area: foundation, shell, controls, map, timeline, modules,
                  documents, dialogs, responsive
src/hooks/        release manifest and release asset loaders
tests/frontend/   unit tests, including the accessibility and claim gates
tests/e2e/        Playwright suite against the built site
```

The data boundary is strict on purpose: `src/lib/releaseManifest.ts` rejects synthetic, demo,
raw-archive, non-`EPSG:4326`, unvalidated, and unlinked assets, and `src/lib/releaseData.ts` rejects
malformed published rows (coordinate axis swaps, negative volumes, non-integer counts, fractional
event counts, malformed geometry, a crossing total that disagrees with its own components). No module
substitutes fallback content.

## Local development

```bash
npm ci
npm run dev        # development server
npm run lint
npm run test
npm run test:e2e   # 59 browser tests against the built site
npm run build
npm run preview    # serve the production build
```

Useful URL parameters:

| Parameter | Effect |
|---|---|
| `?module=TRAFFIC` | open a module directly (`CROSSINGS`, `CRZ`, `AIR`, `EQUITY`, `SOURCES`) |
| `?date=2025-03-31` | timeline date |
| `?borough=Queens&day=Weekday&band=AM%20peak%20(06-09)` | traffic filters |
| `?crossingsFrom=2024-01-01&crossingsTo=2024-06-30` | crossings window |
| `?module=AIR&air=hourly&airTime=2026-09-08T23:00:00.000Z` | measured-air resolution and timestamp |
| `?map=software` / `?map=gpu` | force the renderer |
| `?v=<build>` | build identity; a mismatch with the running build shows a stale-build banner |

## Site files, search, and headers

The build ships everything a public site is expected to serve, and the deployment gate refuses a
candidate that is missing any of it:

| File | Purpose |
|---|---|
| `robots.txt` | Allows crawling, points at the sitemap, and keeps crawlers out of `/data/releases/` |
| `sitemap.xml` | One URL. Module and filter state live in query strings, so those variants are views of the same page and are not listed separately |
| `404.html` | Served with a real 404 status for anything unmatched |
| `site.webmanifest`, `apple-touch-icon.png`, `icon-512.png`, `favicon.svg` | Install and home-screen icons |
| `og.png` | 1200x630 social card, generated from a title card |
| `security.txt` | Security contact, at the root rather than `/.well-known/` because Firebase excludes dotfile paths from deployment |

The document head carries a canonical URL, Open Graph and Twitter card tags, and `Dataset` plus
`WebSite` structured data. **The structured data and the `<noscript>` asset list are generated from the
release manifest at build time.** They used to be hand-written, and they went stale exactly as
hand-written metadata does: they named a superseded release and advertised distribution URLs that had
been removed, so a crawler or a no-JavaScript reader following them got 404s. The gate now refuses a
build whose shell describes a release other than the one the manifest serves, or whose structured data
does not link every published asset.

Security headers are applied to every response: `Content-Security-Policy`, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and a `Permissions-Policy` that
denies every capability the site does not use. The policy was validated by running the app under it
and reading the browser's own violation reports, not by guessing the allowlist. `style-src` needs
`'unsafe-inline'` because the map sets element styles directly, and `font-src` needs `data:` because
the build inlines one small font subset; both are documented rather than silently broad.

There is deliberately **no catch-all rewrite**. Only `/` and `/index.html` rewrite to the SPA shell,
so a mistyped or superseded asset path returns 404 instead of a 200 carrying an HTML page.

## Verification

```bash
npm run test                              # 228 tests, including accessibility and claim gates
npm run pipeline:test                     # 43 pipeline tests, includes the contract enforcement
npm run test:e2e                          # 66 browser tests, desktop and phone viewports
python3 scripts/release_acceptance.py     # 66 checks, blocks a bad deploy
python3 visualization/kepler/validate_kepler_export.py   # 34 checks
```

The release gate blocks an unbuilt, synthetic, unvalidated, unchecksummed, unlinked, oversized,
credentialed, wrong-target, over-cached, multi-release, or stale-shell candidate. Every rejection path
was exercised before being trusted. `.github/workflows/verify.yml` runs the typecheck, lint, unit
tests, build, gate, and end-to-end suite on every push and pull request.

## Further reading

- `docs/submission/` — evidence, methods, traceability, demo script, known gaps (start here)
- `docs/PRD.md`, `docs/DATA_STRATEGY.md`, `docs/ARCHITECTURE.md`, `docs/TECHNICAL_DESIGN_DOCUMENT.md`
- `docs/ENGINEERING_PLAN.md` — the plan and its definition of done
- `docs/TOLL_SHADOW_MHC_EVENT_AUDIT.md` — the original archive audit
- `docs/deployment/` — hosting preview and rollback runbook, with the rehearsed rollback procedure
- `plan/` — the delivery plan and its execution log
- `visualization/kepler/` — the Kepler reproducibility artifact and its validator. Kepler is a
  research and visual-QA tool, **not** the product runtime.
- `coordination/agents/` — per-lane work logs with evidence for each phase

`PLAN.md` at the repository root is the original frontend build plan, and it is superseded in two
places by the PRD (it scopes expected values and synthetic data, which the PRD lists as non-goals).
Where the two disagree, the PRD governs.

## Scope guardrails

In scope: observed measurements with window, grain, source, and limitations; separate modules that are
never combined into one number; "Not available for this claim" where no asset exists.

Out of scope: causal or counterfactual estimates, expected traffic baselines, current DAC
designation claims, local health outcomes, and treating historical air or health context as a current
measurement.
