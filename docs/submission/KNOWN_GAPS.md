# Known Gaps

Stated plainly, ordered by how much they affect a reviewer's ability to trust or use the product.

## 1. Built candidate, not yet deployed

The local built candidate serves release `2026-09-18.1` in the repository build and passes the release acceptance gate. The prior production deployment remains release `2026-09-16.2`; this candidate has not been deployed.

What is still missing around that: nobody outside this workstream has reviewed the candidate result, there is no uptime or error monitoring, and rollback is a manual `firebase hosting:rollback` (see `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md`).

The Firebase target itself is corrected and verified: the account owns exactly one project, `tollshallow` (number `1094344081770`), and the repository `.firebaserc` now names it instead of the inaccessible plural `tollshallows`.

## 2. Three evidence modules have no published asset

`EQUITY`, `CONFIDENCE`, and `HOTSPOTS` render an explicit "Not available for this claim" state. Their underlying material — 2023 DAC layers, historical asthma records, and any hotspot ranking — is excluded from Release 1. `AIR` now publishes preliminary observed NYCCAS PM2.5 monitor measurements at daily and hourly resolution, with missing values preserved and a non-causal label.

## 3. Facility geometry remains provenance-limited

The source register now resolves plaza identifiers 21–30 to named facilities from authority metadata,
and the release assets keep those names. The remaining limitation is geometry: facility points and
the 12 CRZ detection points still come from legacy derivatives with approximate supplied
coordinates, so the UI treats them as context markers rather than exact detector locations.

## 4. Traffic coverage is thin and has gaps

The published traffic asset contains 2,561 aggregates over 195 segments, derived from 177,571 of 1,875,154 source rows. It publishes only the combinations the source actually observed: 195 segments x 21 months x 2 day types x 5 time bands would be 40,950 cells, and the release carries the 2,561 that exist rather than zero-filling the rest. Three months (2024-07, 2024-08, 2025-08) contain no published rows at all. A reviewer should read the map as a **sample of sampled counts**, not as continuous coverage.

## 5. Performance: the MapLibre chunk is large

`npm run build` emits a >500 kB warning for the lazy-loaded MapLibre chunk (1,050 kB raw / 287 kB gzip). This is unchanged from the pre-implementation baseline. The data payload is 45,890,466 bytes, within the measured 64 MiB gate budget; the remaining work is code-splitting and asset chunking, not data reduction. No tiling decision has been made; `docs/ARCHITECTURE.md` requires a measured justification before adding PMTiles.

## 6. Accessibility and E2E coverage are incomplete

Keyboard navigation, visible focus, `aria-live` status regions, reduced-motion handling, and an
automated accessibility test are implemented. There is still no full Playwright E2E suite for module
switching, deep links, and mobile viewport behavior.

## 7. Development-prototype code remains in the production bundle

`ConfidencePanel`, `HotspotDrawer`, `HotspotDetailPanel`, and `analysis.ts` are unreachable in a production build (the dev flag cannot be enabled outside dev mode, and `vite.config.ts` refuses it), but their components and labels are still bundled. Verified absent from the bundle: synthetic datasets, `BOROUGH_VULNERABILITY`, and the counterfactual ranking functions. Removing the dead components would shrink the bundle but risks deleting work the team may still want for prototyping, so it is deferred rather than done unilaterally.

## 8. Two files exceed the 400-line guideline

`src/App.tsx` (499 lines) and `src/components/Map/MapShell.tsx` (693 lines) are above the typical range and below the 800-line ceiling. Both are cohesive, and splitting them mid-release-risk was judged worse than deferring; the extraction points are the release-selection logic and the synthetic overlay renderer.

## 9. The Kepler artifact still rests on undocumented legacy derivatives

`visualization/kepler/validate_kepler_export.py` proves the export matches its four declared inputs by identity, row count, schema, and value (34 checks). It cannot prove those inputs are analytically approved: the prepared CSVs' policy labels, hourly estimate, and aggregation rules remain undocumented. Kepler is a source-side reproducibility artifact and is not part of the runtime.

## 10. The deployment gate has provisional thresholds

The gate's measured 64 MiB budget for `dist/data` covers the on-demand hourly NYCCAS CSV, while the
entry and lazy map chunks have separate gzipped budgets. CI runs the gate on push, but live preview
smoke checks remain a manual deployment-runbook step.

## 11. Final review should use the merge commit

This package is being reconciled through a Git merge that preserves the local `2026-09-18.1` AIR
candidate and the newer `origin/main` release line. Review should use the completed merge commit,
not either parent commit alone.
