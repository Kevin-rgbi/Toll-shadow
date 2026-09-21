# The Toll Shadow

A source-backed evidence explorer for New York City traffic observations around the Congestion Relief
Zone. It shows what a published data release measures, over which window, from which source, and with
which stated limits.

**It does not publish a counterfactual, a causal policy estimate, a current air-quality measurement,
or a post-2025 health outcome.**

**Live:** <https://tollshallow.web.app> · **Release under review:** `2026-09-20.5`

---

## Status: a complete Release 1 slice, not the whole project

This build does what Release 1 asked for and states what it still does not do. Read both lists.

**Shipped, with published data and a link to the source for every figure:**

- Six published assets from six registered sources, served by the app: traffic observations, MTA
  facility crossings, CRZ entry aggregates, a modelled historical air surface, historical asthma
  context, and archived equity geography.
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
- **The map is view-only for published points.** The click-to-inspect card can only open in a
  development build, because the hit targets come from the synthetic prototype frame and a production
  bundle never loads one. Making published points selectable is unbuilt work.
- **`CONFIDENCE` and `HOTSPOTS`** render only under the development flag: a confidence composition and
  a hotspot ranking both imply an inference this data cannot support.
- **No uptime or error monitoring**, and **no independent human review** of the code or the data.
  Both are recorded owner decisions.
- **The two derivation recipes cannot be re-run here** (`rasterio` and `shapely` are not installed), so
  the published derivatives are currently the only copy of that step's output.
- Development-labelled strings remain in components that ship, in development-guarded branches. The
  prototype modules themselves are absent from the production bundle; the strings are not.
- Nothing here is a final visual brand direction; the interface is a deliberate editorial pass.

`docs/submission/KNOWN_GAPS.md` states all of this at length, and `docs/submission/TRACEABILITY.md`
maps every Release 1 requirement to the test or release check that proves it.

## Data used, and where it comes from

**Raw source files are not in this repository.** They total ~321 MB. Every source is registered with
its authoritative URL, SHA-256, coverage, grain, CRS, and its allowed and forbidden uses:

- `data/catalog/sources.yaml` — the source register (15 entries)
- `data/README.md` — how to obtain the raw files and reproduce the release

Six of those entries feed the published release:

| Source | Publisher | Published as | Coverage | Window |
|---|---|---|---|---|
| `dot_automated_traffic_counts_archive_20260915` | NYC DOT (`7ym2-wayt`) | `traffic_observations` | 2024-01-01 → 2025-12-31 | 2,561 segment aggregates |
| `mta_daily_bridge_tunnel_traffic_archive_20260915` | MTA (`fcbp-umit`) | `facility_crossings` | 2024-01-01 → 2025-04-12 | 8,352 daily rows |
| `mta_crz_entries_archive_20260920` | MTA (`t6yz-b64h`, derived here) | `crz_context` | 2025-01-01 → 2026-09-30 | 252 monthly aggregates |
| `nyccas_air_context_derived_2016` | NYC Community Air Survey (derived here) | `historical_context` | 2016 | 78×78 relative grid |
| `nys_asthma_context_derived_historical` | NYS Department of Health (archived) | `health_context` | 2000 → 2019 | 132 records |
| `nyc_dac_context_derived_2023` | NYS Climate Justice WG / NYSERDA (archived) | `dac_context` | 2023 | 958 census tracts |

The three `*_derived_*` sources publish a recorded recipe next to their register entry, in
`pipeline/scripts/`. That matters because the older Kepler-era derivatives could not be reproduced from
anything in the repository, which is why they are no longer release inputs.

Published release outputs **are** committed, so the data actually shipped can be inspected directly:

```
data/releases/2026-09-20.5/
  manifest.json                 assets, checksums, source URLs, coverage, grain, limitations
  quality.json                  rows inspected / included / rejected per source
  README.md                     human-readable changelog with a source URL per asset
  traffic_observations.geojson  2,082,788 bytes, EPSG:4326
  facility_crossings.json       3,596,098 bytes
  crz_entry_summary.json           85,191 bytes
  air_context.json                 34,186 bytes
  health_context.json              28,287 bytes
  equity_context.geojson          481,251 bytes
public/data/manifest.json       the pointer the app fetches, generated by the build
public/data/releases/...        the browser-facing copy of the above
```

Canonical copies of every past release stay under `data/releases/`; the build serves only the one the
pointer names, which is why `2026-09-20.5` is the only directory under `public/data/releases/`.

What the pipeline actually did with the raw files:

| Source | Inspected | Included | Rejected | Result |
|---|---:|---:|---:|---|
| NYC DOT automated traffic counts | 1,875,154 | 177,571 | 1 | 2,561 aggregates |
| MTA daily bridge and tunnel traffic | 98,053 | 8,352 | 0 | 8,352 daily rows |
| MTA CRZ entry aggregates | 252 | 252 | 0 | 252 monthly rows |
| NYCCAS modelled surface | 2,607 | 2,607 | 0 | 78×78 grid |
| NYS asthma context | 132 | 132 | 0 | 132 records |
| NYC disadvantaged-communities context | 958 | 958 | 0 | 958 tracts |

The single rejected DOT row is the archived negative-volume sentinel (`Vol = -1`); it is rejected and
reported, never coerced to zero. Rows outside the 2024-2025 window are excluded by the declared
coverage, which is why 1.87M source rows produce 177,571 included rows.

## Pipeline

```
raw CSV / archive -> contract validation -> aggregation or derivation -> release assets + manifest + quality report
```

- `pipeline/src/` — CSV contract reader, traffic, MTA, CRZ and context adapters, geospatial transform
  (EPSG:2263 to EPSG:4326), measure-spec validation, context validators, release builder
- `pipeline/scripts/` — the recorded derivation recipes for the air, health, and equity context sources
- `pipeline/methods/release-1.yaml` — the approved measure spec: six descriptive measures with their
  numerators, denominators, aggregation, inclusion and exclusion rules, and the one excluded asset kind
  with its reason
- `data/contracts/*.yaml` — one contract per published domain plus the release-manifest contract, which
  `pipeline/tests/contracts.test.mjs` enforces against the manifest that actually publishes
- `pipeline/tests/` — fixtures and tests, including the negative cases (unknown plaza, negative volume,
  fractional event count, malformed geometry, unregistered source URL)

Reproduce the release (raw files must be placed under `../../data/raw/` first; see `data/README.md`):

```bash
node pipeline/scripts/build-release.mjs \
  --release-id 2026-09-20.5 \
  --generated-at 2026-09-20T00:00:00.000Z
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
npm run test       # 199 unit tests
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
npm run test                              # 199 unit tests, includes the accessibility and claim gates
npm run pipeline:test                     # 38 pipeline tests, includes the contract enforcement
npm run test:e2e                          # 59 browser tests, desktop and phone viewports
python3 scripts/release_acceptance.py     # 58 checks, blocks a bad deploy
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
