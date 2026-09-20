# Known Gaps

Stated plainly, ordered by how much they affect a reviewer's ability to trust or use the product.

## 1. Deployed to production, but unreviewed

`https://tollshallow.web.app` now serves Release 1 (release `2026-09-16.2`), verified live: HTTP 200, correct build stamp, published assets matching their manifest checksums, zero console errors. It previously returned HTTP 404.

What is still missing around that: nobody outside this workstream has reviewed the deployed result, there is no uptime or error monitoring, and rollback is a manual `firebase hosting:rollback` (see `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md`).

The Firebase target itself is corrected and verified: the account owns exactly one project, `tollshallow` (number `1094344081770`), and the repository `.firebaserc` now names it instead of the inaccessible plural `tollshallows`.

## 2. Four evidence modules have no published asset

`AIR`, `EQUITY`, `CONFIDENCE`, and `HOTSPOTS` render an explicit "Not available for this claim" state. Their underlying material — historical NYCCAS surfaces, 2023 DAC layers, historical asthma records, and any hotspot ranking — is excluded from Release 1 because the release would otherwise imply a current or causal claim the data cannot support. The reason is shown in the UI, not hidden.

## 3. Facility names are not published

The source register resolves plaza identifiers 21–30 to named facilities from authority metadata, but the published `facility_crossings` asset carries identifiers only. The crossings module therefore shows `Plaza 21`, `Plaza 22`, … and states that no name mapping is published. Adding names requires the pipeline to publish and validate that mapping first.

## 4. Traffic coverage is thin and has gaps

The published traffic asset contains 2,561 aggregates over 195 segments, derived from 177,571 of 1,875,154 source rows. It publishes only the combinations the source actually observed: 195 segments x 21 months x 2 day types x 5 time bands would be 40,950 cells, and the release carries the 2,561 that exist rather than zero-filling the rest. Three months (2024-07, 2024-08, 2025-08) contain no published rows at all. A reviewer should read the map as a **sample of sampled counts**, not as continuous coverage.

## 5. Performance: the MapLibre chunk is large

`npm run build` emits a >500 kB warning for the lazy-loaded MapLibre chunk (1,061 kB raw / ~289 kB gzip), plus a 277 kB main bundle. The data payload is 4.98 MB against the gate's 8 MiB ceiling. The remaining work is code-splitting the map chunk and loading each asset only for the module that needs it: today both release assets are fetched on load regardless of module. No tiling decision has been made; `docs/DATA_STRATEGY.md` requires a measured bottleneck before adding PMTiles.

## 6. Accessibility and E2E coverage are incomplete

Keyboard navigation, visible focus, `aria-live` status regions, and reduced-motion handling are implemented. There is no automated accessibility gate and no Playwright E2E suite, so module switching, deep links, and mobile viewport behavior are verified by code review and unit tests rather than by browser automation.

## 7. Development-prototype code remains in the production bundle

`ConfidencePanel`, `HotspotDrawer`, `HotspotDetailPanel`, and `analysis.ts` are unreachable in a production build (the dev flag cannot be enabled outside dev mode, and `vite.config.ts` refuses it), but their components and labels are still bundled. Verified absent from the bundle: synthetic datasets, `BOROUGH_VULNERABILITY`, and the counterfactual ranking functions. Removing the dead components would shrink the bundle but risks deleting work the team may still want for prototyping, so it is deferred rather than done unilaterally.

## 8. Two files exceed the 400-line guideline

`src/App.tsx` (570 lines) and `src/components/Map/MapShell.tsx` (790 lines) are above the typical 400-line range. App.tsx is cohesive; MapShell.tsx is now within ten lines of the 800-line hard ceiling and should be split before more work lands in it. The extraction points are the synthetic overlay renderer (dev-only) and the release layer wiring.

## 9. The Kepler artifact still rests on undocumented legacy derivatives

`visualization/kepler/validate_kepler_export.py` proves the export matches its four declared inputs by identity, row count, schema, and value (34 checks). It cannot prove those inputs are analytically approved: the prepared CSVs' policy labels, hourly estimate, and aggregation rules remain undocumented. Kepler is a source-side reproducibility artifact and is not part of the runtime.

## 10. The deployment gate has provisional thresholds

The gate's 8 MiB budget for `dist/data` is a placeholder; the current payload is 4.98 MB, so the margin is real but unmeasured against a stated target. No numeric performance budget was ever agreed in `docs/`, which leaves one PRD success metric unverifiable as written. The gate is also manual — there is no CI workflow that runs it on push.

## 11. The work is committed, but unreviewed

Everything is committed on `main` in the `Toll-shadow` repository and pushed, with `release-1-evidence-modules` merged. It has not had an independent code or data review by anyone else on the team, and there is no CI running the checks on push.
