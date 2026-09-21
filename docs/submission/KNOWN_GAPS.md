# Known Gaps

Stated plainly, ordered by how much they affect a reviewer's ability to trust or use the product.

Figures below were read from the built release and the built bundle on **2026-09-20**, not carried
forward from an earlier revision of this document.

## 1. Deployed to production, but unreviewed

`https://tollshallow.web.app` serves release `2026-09-20.5`, verified live: HTTP 200, `release_id` and
`status: validated` in the manifest, six assets at their published checksums, and the modules render
published figures. Nobody outside this workstream has reviewed the deployed result, and there is no
uptime or error monitoring, so nothing outside a reader's browser reports that the site stopped
working. Both are recorded owner decisions rather than oversights.

Rollback was rehearsed on a preview channel on 2026-09-20 (see
`docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md`). That rehearsal found that the two commands the
runbook used to document — `hosting:releases:list` and `hosting:channels:delete` — do not exist in
firebase-tools 15.30, and that there is no CLI rollback command at all in that version: rolling the
live site back is a Firebase console operation, or a redeploy of the previous artifact. The runbook
now records the working commands and the observed behaviour.


## 2. Two modules still have no published asset

`CONFIDENCE` and `HOTSPOTS` render under the development flag only, because a confidence composition
and a hotspot ranking both imply an inference the published data does not support. `AIR` and `EQUITY`
used to be in this group and no longer are: release `2026-09-20.5` publishes a modelled historical air
surface and the archived 2023 disadvantaged-communities geography, each with its vintage and a
non-causal label.

## 3. The air surface carries no units

The NYCCAS archive this project can reach carries no unit codebook, so the surface is published as a
field normalised to itself: `relative 0-1 within this surface; absolute units are not established`.
Pollutant and period labels are inferred from the source filename and the panel says so. The module
therefore shows where the modelled surface was higher *within itself* and deliberately shows no
concentration. A reviewer must not read it as a measurement.


## 4. Traffic coverage is thin and has gaps

The published traffic asset carries 2,561 aggregates over 195 segments, derived from the sampled rows
the source actually observed. 195 segments x 21 months x 2 day types x 5 time bands would be 40,950
cells; the release publishes the combinations that exist rather than zero-filling the rest, and three
months (2024-07, 2024-08, 2025-08) contain no published rows at all. Read the map as a **sample of
sampled counts**, not as continuous coverage.

## 5. Historical contexts end in the past

Health context is archived NYS asthma data at county (borough) level, in rolling multi-year periods
ending in 2019 or earlier — 132 records. Equity context is the **archived 2023** disadvantaged-communities
criteria; the 2025 revision means it cannot be presented as a current designation. Air context is a
2016 modelled surface. None of these is a post-policy outcome, and the modules state their periods.


## 6. Performance: the map chunk dominates the build

`npm run build` emits a >500 kB warning for the lazy-loaded MapLibre chunk: **1,065 kB raw / 292 kB
gzip**. The main bundle is 325 kB raw / 100 kB gzip and the stylesheet 110 kB. The data payload is
**6.02 MiB of the gate's 64 MiB merged ceiling** across six assets.


Each asset is now fetched only while the module that reads it is open, so the entry does not carry the
data. What remains is the map chunk itself. No tiling decision has been made: `docs/DATA_STRATEGY.md`
requires a measured bottleneck before adding PMTiles, and none has been measured.

## 7. Three files still hold size allowances

`src/components/Map/MapShell.tsx` no longer does: it went from **791 lines to 362** by moving its
drawing routine to `mapOverlayDraw.ts`, its map lifecycle to `useMapInstance.ts`, and its release
layers to `useMapLayers.ts`, each verified against the behaviour it replaced (identical overlay
pixels; identical map state across eleven observed properties; the published traffic layer still
reporting "60 of 100 points in view").

What remains above the 200-400 typical range is `src/App.tsx` (633), `src/components/Map/RasterMap.tsx`
(615) and `src/lib/releaseData.ts` (483). All three are ratcheted by
`tests/frontend/sourceSize.test.ts`: they may not grow, and a file that comes back inside the typical
range must leave the recorded list. `RasterMap` holds the whole software-renderer path, and `App`
wires every surface together. The 1,612-line stylesheet that used to be the worst offender is now
nine files under `src/styles/`, none larger than 326 lines.


## 8. The map is view-only for published points, and the selection card cannot open

The click-to-inspect card on the map is reachable only in the development build. `hitTargetsRef` is
written by exactly one place, the prototype overlay frame, and that frame returns no targets in a
release build because a production bundle never loads a synthetic dataset. Clicking a published point
therefore finds no hit, clears the selection, and no card appears.

This is not a regression from the recent map split — the behaviour is byte-identical before and after
it — but it means the published traffic layer is decoration rather than an interactive surface, and
the synthetic-mode strings still in that card's markup are unreachable in production. Making published
points selectable is unbuilt work, and it should come with the same claim discipline the modules have.

## 9. Development-labelled strings remain in components that ship

The prototype *modules* are out of the production bundle: `ConfidencePanel`, `HotspotDrawer` and
`HotspotDetailPanel` no longer appear in it at all, verified by searching for copy unique to them
(0 occurrences) rather than for their names. What remains are string literals in development-guarded
branches of components that legitimately ship — the release ribbon's dev summary, the app's dev-build
eyebrow, and the selection card's synthetic-mode labels described above. They are inert text, not
reachable UI, but they are the reason a search for "SYNTHETIC DEV" in the bundle still returns hits.

## 10. The Kepler artifact rests on undocumented legacy derivatives

`visualization/kepler/validate_kepler_export.py` proves the export matches its four declared inputs by
identity, row count, schema, and value — 34 checks, where previously 18 passed and 4 failed on a path
bug that stopped the identity checks from running at all. It cannot prove those inputs are analytically
approved: the prepared CSVs' policy labels, hourly estimate, and aggregation rules remain
undocumented. Kepler is a source-side reproducibility artifact and is not part of the runtime.

## 11. The deployment gate's data budget is a working figure

The gate's 64 MiB ceiling for `dist/data` is a merged-branch compatibility number, not a surveyed
ideal; release `2026-09-20.5` itself is 6.02 MiB, and the extra headroom exists because the repository
retains the `2026-09-18.1` AIR/PM2.5 candidate path with its large hourly CSV. The entry and map-chunk
budgets have numbers in `docs/DATA_STRATEGY.md` and the gate measures both.

## 12. The initial-request budget is documented but not enforced

`docs/DATA_STRATEGY.md` sets four browser budgets. Three are measured by the release gate (gzipped
entry, gzipped map chunk, total published data). The fourth — twelve requests to first render — is a
design target with nothing measuring it, because counting requests "to first render" reliably needs a
browser run and a definition of first render that does not flap. It is labelled unenforced in the
budget table rather than left to look gated.

## 13. The derivation recipes still cannot be re-run on this machine

Unchanged from the earlier revision: `rasterio` and `shapely` are installed in no interpreter here, so
the published derivatives under `data/derived/` remain the only copy of that step's output. The
recipes are recorded and reviewable; they are not executable here.

## 14. The work is unreviewed by a second person

CI now runs the typecheck, lint, unit tests, accessibility gate, build, release gate, and the
end-to-end suite on every push and pull request, and the release gate blocks a `synthetic: true`
manifest. What CI cannot supply is an independent reader: no one else on the team has reviewed the
code or the data.
