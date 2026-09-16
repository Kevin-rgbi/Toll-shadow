# Toll Shadow Agent 2 Log: Product Frontend

**Owner:** Agent 2

## Purpose

This is the required work log for the React/MapLibre product lane. Read it at session start, update it before and after each meaningful phase, and continue until the assigned phase is verified or a concrete dependency is recorded. The frontend must reflect evidence actually released by Agent 1, never invent missing content.

## Mandatory Context Read Order

1. `../../AGENTS.md`
2. `../../docs/PRD.md`
3. `../../docs/DATA_STRATEGY.md`
4. `../../docs/ARCHITECTURE.md`
5. `../../docs/TECHNICAL_DESIGN_DOCUMENT.md`
6. `../../docs/ENGINEERING_PLAN.md`
7. `../../docs/TOLL_SHADOW_MHC_EVENT_AUDIT.md`
8. `../../plan/2026-09-15_21-46-00_evidence_product_delivery.md`
9. `AGENT_1_LOG.md` and `AGENT_3_LOG.md` in this directory.

The project is organized under `../../`. The GitHub application lives in `../../source/github-repo/`. Its existing `public/data/demo/`, `types/demo.ts`, and `lib/analysis.ts` are known synthetic scaffolding: they are not release evidence and must not be carried into the production path.

## Shared Non-Negotiables

- Release 1 is a transparent evidence explorer. It must distinguish observed measures, source windows, units, methods, and limitations.
- Do not fabricate data, maps, outcomes, source provenance, causal claims, current DAC designation, or health/environmental results.
- React plus MapLibre is the production stack. Kepler JSON/screenshots are research/visual-QA references only.
- Fetch approved bounded assets by URL through a versioned manifest. Do not embed raw CSV, ESRI GRID, statewide geometry without measurement, or synthetic fixtures in shipped UI.
- Map layers must use valid EPSG:4326 release assets and have accessible empty/loading/error states.
- Preserve the existing project patterns where sound; make focused changes and fresh lint/test/build verification.

## Ownership and Boundary

**Own:** `../../source/github-repo/src/`, frontend tests, and browser-facing documentation that describes visible interaction or states.

**Do not edit:** `../../source/github-repo/pipeline/`, `../../source/github-repo/data/contracts/`, `../../data/catalog/`, data releases (Agent 1), Firebase config/deployment automation (Agent 3), or another agent's log. If the manifest schema is insufficient, record the required change here and coordinate with Agent 1 before implementation.

## Current Assignment

Implement plan steps A5 through A7 only after reading the source contract in Agent 1's completed handoff. First establish a typed release-manifest client and honest loading/error/empty states. Then replace the synthetic-only interface with source-specific traffic, MTA crossings, CRZ context, DAC/historical-context, and methodology surfaces as approved data becomes available. Do not block on aesthetic polish; correctness, map usability, responsive layout, and claim safety come first.

### Required Frontend Rules

- Remove or fully isolate synthetic `DemoData` and fixed `BOROUGH_VULNERABILITY` from the production rendering path.
- A missing or invalid release manifest must show a clear failure state, not synthetic fallback content.
- Every visible metric needs a source/method/limitation path.
- Never say a measure was "caused," "expected," or "prevented" unless a reviewed method spec and approved release explicitly support it.
- Keep module data separate. A traffic measure, MTA facility crossing, CRZ entry, DAC context, and historical raster/context are not interchangeable.

## Running Status

| UTC time | Phase | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-15 | A5: frontend foundation | waiting on Agent 1 contract | Existing app builds but renders synthetic demo data. Read context now; begin manifest-client/type work only once the contract handoff is recorded. |
| 2026-09-16 02:07 UTC | A5.0: context + dependency check | in progress | Full mandatory read done. Agent 1 has no `data/catalog/`, no `source/github-repo/data/contracts/`, and `pipeline/` still only holds the deferred `README.md`, so no release contract handoff exists yet. Proceeding only with the contract-documented part of A5 (typed release-manifest client + honest loading/error/empty states + removal of the synthetic production path); A6 module wiring stays blocked on A4 release assets. |
| 2026-09-16 02:16 UTC | A5: release-manifest boundary | completed (foundation) | Synthetic data is no longer reachable from a production build. lint clean, frontend suite 8 files / 36 tests pass (full `npm run test` run: 11 files / 41 tests), build passes, `dist/data` holds only the pointer manifest. A6 evidence modules remain blocked on Agent 1 A2-A4 assets. Handoff below. |

## Contract response received from Agent 1 (2026-09-16 02:25 UTC)

Agent 1's log records phases A1, A2, and A3 as completed and A4 in progress, and its A2 handoff explicitly answers the two contract questions raised above:

- Accepted: "Agent 2 may consume the release contract's `kind`, `format`, and optional `policy_reference_date`."
- Aligned: "MTA asset kind is `facility_crossings` to match the frontend validator." Its `pipeline/methods/release-1.yaml` declares `asset_kind: traffic_observations` and `asset_kind: facility_crossings`, matching `RELEASE_ASSET_KINDS` in `src/lib/releaseManifest.ts`.

One interface detail to settle when A4 publishes the manifest: Agent 1's measure specification nests the date as `policy_reference.date` (`pipeline/methods/release-1.yaml`), while `src/lib/releaseManifest.ts` reads a top-level `policy_reference_date` string. A4 owns the manifest writer, so either the builder emits the top-level field or this lane switches to the nested shape. This lane will adapt to whichever A4 publishes; no frontend change is made until a manifest exists.

### A5 contract assumptions recorded (2026-09-16 02:07 UTC)

`docs/DATA_STRATEGY.md` "Published-asset contract" and `docs/ARCHITECTURE.md` "Frontend manifest" are the only written sources for the browser contract, so the client in `src/lib/releaseManifest.ts` validates exactly this field set and nothing more:

- manifest: `release_id`, `schema_version`, `generated_at`, `status`, `source_ids`, `transform_version`, `coverage{start,end}`, `limitations[]`, `assets[]`, optional `policy_reference_date`.
- asset: `kind`, `path`, `format`, `sha256`, `coverage`, `grain`, `source_ids`, `transform_version`, `status`, `limitations[]`, optional `geometry_crs`, `bytes`.

Required change for Agent 1 before A6/A4 publication: confirm or correct these two additions that are not spelled out in the docs — the per-asset routing fields `kind` and `format` (needed because the PRD keeps traffic, MTA crossings, CRZ, DAC, and historical context strictly separate), and optional `policy_reference_date` (the timeline marker date must come from the release, not be hardcoded in the UI).

## Completion Handoff Template

Append a row and concise notes after each completed phase:

```text
### Phase A?-<name> completed — YYYY-MM-DD HH:MM UTC
Changed:
Verified:
Commands and results:
Data contract consumed:
Open dependency or next phase:
```

---

### Phase A5-release-manifest-boundary completed — 2026-09-16 02:16 UTC

Changed:
- Added `src/lib/releaseManifest.ts` — the single production data boundary. Validates the documented released-asset contract (`release_id`, `schema_version`, `status`, `coverage`, `source_ids`, `transform_version`, `limitations`, `assets[]`; per asset `kind`, `path`, `format`, `sha256`, `coverage`, `grain`, `source_ids`, `transform_version`, `status`, `limitations`, optional `geometry_crs`, `bytes`). Rejects `synthetic: true` anywhere, `/data/demo/`, `/data/raw/`, non-`.json`/`.geojson` paths, non-`EPSG:4326` geometry, unvalidated assets, and empty provenance/limitation arrays.
- Added `src/hooks/useReleaseManifest.ts` (states `loading` | `ready` | `empty` | `error`; the `empty` state requires an explicit `status: "unpublished"` pointer so a broken manifest can never be reported as "nothing published") and `src/hooks/useReleaseBoundary.ts` (loads only the release `boundary_zone` asset, no geometry fallback).
- Replaced `src/lib/dataManifest.ts`, `src/types/demo.ts`, `src/hooks/useManifestDataset.ts` with `src/lib/devSyntheticDataset.ts`, `src/types/devSynthetic.ts`, `src/hooks/useReleaseManifest.ts`. The dev loader refuses to run unless `import.meta.env.DEV` and `VITE_USE_DEMO_DATA=true`; it requires a manifest that declares itself synthetic, and it reads `public/data/demo/dev-manifest.json` (new file), not the release pointer.
- Removed synthetic content from the production path: fixed `BOROUGH_VULNERABILITY` weights and `buildEquitySignals` are gone (with `EquityPanel`), prototype rankings/confidence are renamed `Synthetic*`, the counterfactual `EXPECTED` compare UI renders only under the dev flag, `App.tsx` shows release facts plus an explicit "Not available for this claim" panel per module, and `MapShell.tsx` draws no estimated marks without the dev dataset.
- Split the oversized map file to satisfy the project size rule: `src/components/Map/mapConfig.ts` and `src/components/Map/mapOverlay.ts` (MapShell 991 → 635 lines, no behavior change).
- `public/data/manifest.json` is now an explicit unpublished pointer; `vite.config.ts` refuses a production build with `VITE_USE_DEMO_DATA=true` and strips `public/data/demo` from build output; `README.md` and the module/methods copy no longer describe synthetic or counterfactual behavior as product features.

Verified:
- `npm run lint` — clean (this session).
- `npm run test` — full run 11 files / 41 tests passed; frontend lane subset (`npx vitest run tests/frontend`) 8 files / 36 tests passed. Baseline for this lane was 13 tests in 4 files. New coverage: release contract validation (13), module/status copy (5), shipped-pointer guard (2), app render smoke (2), dev loader isolation (3). Concurrent runs picked up pipeline tests added by the Agent 1 lane during this session.
- `npm run build` — succeeded; only the pre-existing >500 kB MapShell chunk warning.
- `find dist/data -type f` → `dist/data/manifest.json` only (no demo fixture in the artifact).
- `VITE_USE_DEMO_DATA=true npx vite build --mode production` → `Error: Production builds cannot run with VITE_USE_DEMO_DATA=true.`
- `npx vite preview` on the built app: `/` 200, `/data/manifest.json` returns the unpublished pointer, `/data/demo/dev-manifest.json` returns `text/html` SPA fallback (the fixture is absent), not JSON.
- `VITE_USE_DEMO_DATA=true npx vite` dev server serves `/data/demo/dev-manifest.json` as `application/json`.
- Not verified: in-browser rendering, keyboard flow, deep links, responsive layout, and network-throttled map behavior — these are plan step A7 and need a browser pass by a human or the E2E lane.

Commands and results:
- `npm ci` (installed the lockfile deps into `source/github-repo`; no lockfile write by this lane), then the three project commands above, all fresh in this session.

Data contract consumed:
- `docs/DATA_STRATEGY.md` "Published-asset contract", `docs/ARCHITECTURE.md` "Frontend manifest" and "Domain adapters", `docs/PRD.md` FR-01/FR-02/FR-07 and the content rules. No release asset exists yet, so no asset parsing beyond structural validation was implemented — no assumed columns, grains, or field names were invented.

Open dependency or next phase:
- Blocked on Agent 1 (A2-A4): the `kind`/`format` routing fields and optional `policy_reference_date` are additions beyond the written contract and need Agent 1 confirmation before A4 publishes a manifest; the release builder must emit them or tell this lane what to use instead.
- A6 evidence modules (traffic, MTA crossings, CRZ entry, DAC/historical context, methods) stay blocked until validated release assets exist; the mode→asset-kind map in `src/lib/sourceMessaging.ts` is where they will attach.
- A7 hardening inherits two concrete tasks: the 1.05 MB MapShell chunk and the missing browser/E2E coverage.
- Not this lane: the repo-root `PLAN.md` still describes the counterfactual delivery goal; it should be superseded by the workspace `docs/` set rather than edited here.
- Also observed in `source/github-repo` but not authored by this lane: `.firebaserc` now points at `tollshallow` (Agent 3) and `package.json`/`package-lock.json` changed (a `yaml` dev dependency added, lockfile shrank ~468 lines). The verified frontend checks above ran against that dependency set.
- VibeGuard W-14 flagged several of this lane's own edits as "another session or agent recently touched" (releaseManifest.ts, appStore.ts, analysis.test.ts, the plan file, this log). No second writer touched those files: the writes were made only by this session, so the warnings are self-attribution false positives in this case. Real concurrent edits in this repository were limited to Agent 3's `.firebaserc`/`scripts/` and the dependency-file change noted above.
