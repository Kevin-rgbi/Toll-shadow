# Acceptance traceability

Every Release 1 PRD condition, with the test or release check that proves it. This is the engineering
plan's "definition of done" item that was missing until now: previously no FR was mapped to evidence.

Run everything below with:

```bash
npm run test                                  # 166 tests, includes the accessibility and size gates
npm run test:e2e                              # 59 end-to-end tests, desktop and phone viewports
npm run lint
npx tsc -b
npm run build
python3 scripts/release_acceptance.py          # 47 checks
python3 visualization/kepler/validate_kepler_export.py   # 34 checks
```

CI (`.github/workflows/verify.yml`) runs the same set on every push to `main` and every pull request.

| FR | Condition | Evidence | Status |
|---|---|---|---|
| FR-01 | Load a versioned manifest before any data view; fail clearly when missing, malformed, or invalid | `tests/frontend/releaseManifest.test.ts`, `tests/frontend/shippedManifest.test.ts`; gate checks pointer caching, schema, status | Met |
| FR-02 | Landing view names the window and the evidence boundary, with no synthetic, "expected", or causal language | `tests/frontend/moduleStates.test.ts` asserts the absence of causal/expected wording; `sourceMessaging.CLAIM_GUARDRAIL`; story view copy | Met (claim-lint is by test, not by a copy scanner) |
| FR-03 | Traffic module with filters, date range, grain, sample fields, source link | `tests/frontend/trafficSummary.test.ts`, `moduleStates.test.ts`, `releaseData.test.ts`; `tests/e2e/filters.spec.ts` (a filter narrows the figure, writes the URL, and the control reports the applied value); module renders `AssetProvenance` | Met |
| FR-04 | MTA crossings module with **named** facilities, directions, and the MTA caveat | `tests/frontend/crossingsSummary.test.ts`, `moduleStates.test.ts` (name plus published identifier); `pipeline/tests/mta.test.mjs` naming rules; all 8,352 published records named; `tests/e2e/modules.spec.ts` | Met |
| FR-05 | CRZ-entry module with aggregation window and coordinate-precision label | `tests/frontend/crzSummary.test.ts`, `releaseData.test.ts` (`parseCrzEntries`), `moduleStates` a11y surface; `pipeline/tests/release.test.mjs` covers the asset; module states areas-not-points; `tests/e2e/modules.spec.ts` | Met |
| FR-06 | Equity/context module: DAC geography and historical air/health context with release year and non-causal labels | Release `2026-09-20.3` publishes `dac_context` (958 tracts, archived 2023 criteria, labelled historical throughout), `historical_context` (NYCCAS surface as a **relative** field with inferred pollutant and period labels), and `health_context` (132 archived NYS asthma records ending 2019); `tests/frontend/healthContext.test.ts` covers all three parsers against the shapes the sources publish; `tests/e2e/modules.spec.ts` asserts figures render, the canvas paints, the tracts draw, and no failure state is left on screen | Met |
| FR-07 | Every module exposes source URL, coverage, grain, transform version, and limitations | `AssetProvenance` is rendered by all five live modules; `moduleStates.test.ts` asserts "Source and method" and a limitation line; `tests/e2e/modules.spec.ts` asserts every provenance block carries all five fields on both viewports | Met |
| FR-08 | URL encodes the selected module and supported filter state | `tests/frontend/viewState.test.ts`, including build identity and renderer choice round-trip; `tests/e2e/view-state.spec.ts` opens deep links cold and asserts the module and filters are applied and survive a reload | Met |
| FR-09 | Keyboard, focus, reduced motion, and an **automated accessibility gate** | `tests/frontend/accessibility.test.tsx`: eight surfaces, zero serious or critical violations, plus a negative test proving axe reports real violations; `tests/e2e/mobile.spec.ts` covers the phone sheet's `aria-expanded` state and horizontal overflow | Met |
| FR-10 | Deployable through a preview channel before production | Preview channel `p10-rehearsal` deployed, smoke-checked (manifest `release_id` and `status`, cache headers per `firebase.json`), and deleted 2026-09-20; production deploy of `2026-09-20.4` verified live against its manifest. `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md` records the rehearsal and the commands that actually exist in firebase-tools 15.30 | Met |

## PRD success metrics

| Metric | Evidence | Status |
|---|---|---|
| 100% of public data assets have manifest entries, SHA-256, source reference, coverage, status | Gate refuses an asset without a checksum; manifest published with all six assets (traffic, crossings, CRZ, air, health, equity) | Met |
| 0 synthetic records in production assets; **CI** blocks `synthetic: true` | Gate blocks it, and the workflow now runs the gate on push and PR | Met |
| 100% of displayed metrics have a source/method link | `AssetProvenance` in every module | Met |
| Initial payload inside the defined performance budget | Budget numbers live in `DATA_STRATEGY.md` and the gate measures the gzipped entry and map chunk plus the published data payload (6.02 MiB of the 8 MiB ceiling, six assets). Each asset is fetched only while the module that reads it is open, so the entry does not carry the data | Met |
| All blocking acceptance tests pass before a production deploy | Gate run before each deploy; CI enforces on push | Met |

## Known gaps that remain outside the FR list

- **Air context is published as a relative field, not a concentration.** The archive carries no unit
  codebook for the raster family, so the surface is normalised to itself, its pollutant and period
  labels are shown as inferred from the source filename, and the panel deliberately shows no numeric
  scale. This is a recorded decision, not an oversight.
- **Production runs with no uptime or error monitoring**, recorded as an owner decision. Nothing
  outside the browser reports that the site stopped working.
- **No independent human review** of the code or the data. Every workstream here is the same author.
- **Two files hold their allowances rather than being split.** `MapShell.tsx` (791 lines) and
  `RasterMap.tsx` (615) are inside the 800-line hard ceiling but over the 200-400 typical range, and
  they are the map lifecycle and the two renderers — the code that has produced most of this
  project's defects. `tests/frontend/sourceSize.test.ts` ratchets them: they may not grow, and the
  stylesheet that used to be 1,612 lines is now nine files under `src/styles/`.
- **Three development-only panels still ship their markup unreachably.** The panel components render
  only when a synthetic dataset is loaded, which production never does, but their strings remain in
  the bundle. Gating them behind a lazy import was measured and made it worse (five chunks instead of
  two, same strings), so it was reverted. The dataset itself and its functions are genuinely absent
  from the production bundle, verified by search.
- **The Kepler export is validated against identity, not approval.** `validate_kepler_export.py` now
  resolves its declared source CSVs against the workspace (34 checks pass, previously 18 passed and 4
  failed on a path bug) and reports a skip, with its reason, in a checkout that carries no workspace
  data. Passing means the embedded export matches the declared inputs by identity, row count, schema,
  and value — not that the inputs are analytically approved or that any measure is causal.
