# Plan: close Release 1 to 100%

**Created:** 2026-09-20
**Goal:** every Release 1 PRD functional requirement met, or explicitly waived by the owner with a recorded reason. No item left "in progress" without one of those two states.

Baseline: production serves release `2026-09-16.2` at `https://tollshallow.web.app`. FR-01, 02, 03, 07, 08, 10 are met. The rest are listed below with what closes them.

## Reconnaissance already done (facts this plan rests on)

| Question | Finding |
|---|---|
| Is there an authoritative CRZ source? | Yes. `data.ny.gov` dataset `t6yz-b64h`, **6,386,688 rows**, columns include `detection_group`, `detection_region`, `crz_entries`, `excluded_roadway_entries`, `vehicle_class`, `toll_date`. Aggregates can be pulled with SoQL `$group`, so the legacy 12-row summary can be replaced by a documented recipe. |
| Is the NYS DAC layer reachable? | Yes, `2e6c-s6fp` returns geometry. |
| Is the historical health data available? | Yes, already in the archive at `data/raw/health/asthma/` (375 KB). |
| Can the NYCCAS rasters be converted here? | **No GDAL, no rasterio.** The ESRI GRIDs cannot be read without adding a raster stack. |
| Can E2E and a11y tooling be added? | Yes, npm registry reachable. |

## Phases

### P1. Facility names (FR-04) — DONE 2026-09-20

FR-04 asks for **named** facilities. The source register already resolves plaza IDs 21-30 to names from authority metadata; the published asset carries identifiers only.

- Pipeline: publish `facility_name` (and `facility_code`) on each `facility_crossings` record, sourced from the register mapping, with the mapping recorded in the contract.
- Frontend: crossings module shows the name with the identifier, keeping the "no name mapping published" caveat only if it still applies.
- Tests: pipeline test that every plaza in the source maps to a name, and a parser test that an unknown plaza id is rejected rather than rendered nameless.
- Done when: the crossings module shows named facilities and no record can render without one.

### P2. Per-module asset loading and a real performance budget (A7, PRD metric) — DONE

- Define a **numeric** browser asset budget in `docs/DATA_STRATEGY.md` (today it says "the agreed budget" with no number, which makes the PRD metric unverifiable).
- Load each release asset only for the module that needs it, instead of fetching both on every load.
- Record measured payloads against the budget.
- Done when: the budget has a number, the build is inside it, and the gate asserts it.

### P3. Automated accessibility gate (FR-09) — DONE

- Add `axe-core` with a DOM test environment and run it against the shell, each module, and the failure states.
- Wire it into the test suite so it runs with `npm run test`.
- Fix whatever it reports; record the ones that are genuinely not fixable with reasons.
- Done when: an automated accessibility check runs on every test run and passes.

### P4. End-to-end suite (A7)

- Playwright: deep link restores state, module switching, filters change the count line, mobile sheet toggles, an unpublished manifest shows the failure state rather than data, and the renderer fallback switches maps.
- Run against the built preview, not the dev server.
- Done when: the suite passes locally and in CI.

### P5. CI (A8, engineering DoD, PRD metric "CI blocks `synthetic: true`") — DONE

- GitHub Actions on push and PR: install, lint, typecheck, unit tests, build, release gate, accessibility, E2E.
- Upload the gate's JSON as a build artifact.
- Done when: a red gate blocks a pull request, and the workflow passes on `main`.

### P6. CRZ module (FR-05) — DONE

- Pipeline adapter reading `t6yz-b64h` through a bounded SoQL aggregate query: entries by detection group and month, with the query text recorded as the recipe.
- Contract, measure spec entry, and a new `crz_context` asset with its own limitations: aggregated, not raw; detection groups are areas, not detector points.
- Module: entries by group and month, with the aggregation window and the coordinate-precision caveat.
- Tests: adapter fixture test, contract test, parser test in the frontend.
- Done when: the module renders source-backed CRZ summaries with window and precision labels, and the release publishes the asset.

### P7. Equity and historical-context module (FR-06)

- DAC: publish the NYS disadvantaged-communities layer with its release year and a non-causal label; state the archived-2023 scope explicitly, including that the 2025 criteria update makes it historical.
- Health: publish historical county/borough asthma context from the archived source, labelled as historical context ending 2019.
- Air: **cannot be converted here** without a raster stack. Two options, owner decides: add `rasterio` and convert one documented surface, or waive the air layer with the reason recorded.
- Done when: the module shows DAC geography and historical health context with release years and non-causal labels.

### P8. Code health

- Split `MapShell.tsx` (790 lines, near the 800 hard ceiling).
- Stop shipping the unreachable development-prototype components in production builds.
- Done when: no source file exceeds the guideline range, and the production bundle contains no dev-prototype module.

### P9. Traceability (engineering DoD) — DONE (`docs/submission/TRACEABILITY.md`)

- Matrix in `docs/submission/`: every FR mapped to the test or manual release check that proves it.
- Done when: no FR row is empty.

### P10. Rollback rehearsal

- Run a rollback and a re-promote **on the preview channel**, and record the observed behaviour.
- Done when: the runbook's rollback section is marked rehearsed with the date and result.

## Progress after the first pass (2026-09-20)

Done and verified on production: P1 (FR-04), P2, P3 (FR-09), P5 (CI), P6 (FR-05), P9.
Release `2026-09-20.2` carries three assets and is live at `https://tollshallow.web.app`.
151 tests, gate 41 checks, all green.

Still open: P4 (end-to-end suite), P7 (FR-06 equity and air context), P8 (MapShell split),
P10 (rollback rehearsal), and the cross-model review.

## Owner decisions required

These cannot be closed by code. They need a recorded decision from the owner:

1. **Air-quality context (part of FR-06).** Convert a NYCCAS surface with a new raster dependency, or waive it and mark FR-06 as DAC + historical health only.
2. **Uptime and error monitoring.** Needs an external service. Either add one or record that production runs unmonitored by decision.
3. **Independent review.** No workstream can review itself. Somebody else on the team has to read the code and the data, or the owner records that it ships unreviewed.

## Order of execution

P1 → P2 → P3 → P4 → P5 (all small, high value, no external data), then P6 → P7 (new data), then P8 → P9 → P10. Each phase ends with tests, a green gate, a commit, and a log entry.

## Acceptance for the whole plan

- Every FR-01..FR-10 is either proven by a linked test or check, or waived in writing by the owner.
- `npm run test`, `npm run lint`, `npx tsc -b`, `python3 scripts/release_acceptance.py`, the accessibility run, and the E2E suite all pass on `main`.
- CI runs the above on push.
- A new release ID is published and deployed only after the gate is green.
