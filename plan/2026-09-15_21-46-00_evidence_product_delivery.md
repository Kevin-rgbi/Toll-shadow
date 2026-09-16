---
mode: plan
cwd: /home/ihthos/TollShadow-Organized
task: Build Toll Shadow into an exceptional, source-backed public evidence product
complexity: complex
planning_method: research_plus_repository_analysis
created_at: 2026-09-15T21:46:00-04:00
---

# Plan: Toll Shadow Evidence Product Delivery

## Task overview

Transform the existing synthetic React map and unstructured archive into a presentable, defensible, and deployable public product. The work starts with data truth and architecture, then adds source-backed frontend modules, then deploys through the confirmed Firebase project. Final visual-direction work is intentionally a later parallel design phase.

## Baseline and evidence

- Application checkout: `source/github-repo/`, branch `main`, clean at commit `f3049207d93365e1fdb6e6995a921c30d837a6dd`.
- Current frontend checks pass: lint, 13 Vitest tests, and production build. The build emits a >500 kB MapShell chunk warning.
- Current production data entry point is `source/github-repo/public/data/manifest.json`; it is explicitly `synthetic: true` and points to demo assets.
- Current Firebase config points to `tollshallows`, while audited active project is `tollshallow`; no deploy change is authorized by this plan.
- Repository redundancy scan found no duplicate exported types; the material architecture problem is unconnected synthetic analysis/data rather than duplicated code.

## Governing documents

- `docs/research/2026-09-15_delivery_research.md`
- `docs/PRD.md`
- `docs/DATA_STRATEGY.md`
- `docs/ARCHITECTURE.md`
- `docs/TECHNICAL_DESIGN_DOCUMENT.md`
- `docs/decisions/ADR-001_static_first_delivery.md`

## Execution constraints

- Objective: a source-backed static public SPA with reproducible public data releases.
- Compatibility: keep the React/Vite/MapLibre shell unless a later ADR changes it.
- Submission strategy: per-step, with exact evidence written into this plan after every completed step.
- No causal, current-air-quality, or post-policy-health claims without an approved method and data support.
- Do not start implementation until P0.1 has a human-approved source/provenance decision for the unknowns below.

## Phased plan

### Step A0: Research and documentation planning package

- status: `completed`
- Target: research-backed delivery documents and an executable plan.
- Detailed changes:
  - Inspect the current repository, archive, Firebase state, and comparable public products.
  - Write the PRD, data strategy, architecture, TDD, engineering plan, ADR, workspace instructions, and this plan.
- step-level test command:
  - `git -C source/github-repo status --short --branch`
  - `npm run lint && npm run test && npm run build` (run from `/tmp/toll-shadow-audit`, matching the clean repository commit)
  - `/home/ihthos/.codex/skills/plan-flow/scripts/redundancy_scan.sh source/github-repo/src`
- Completion judgment: planning artifacts exist, baseline checks pass, and no application/Firebase/source-data implementation change is made.

### Step A1: Source register and unresolved-fact closure

- status: `completed`
- Targets: `data/catalog/sources.yaml`, `data/raw/`, `pipeline/tests/fixtures/`, `docs/DATA_STRATEGY.md`.
- Work: register every retained source; verify DOT CRS, MTA plaza mapping, DAC release/version, and source URLs/licenses; quarantine non-project material without deleting it.
- Tests: source-register schema validation; SHA-256 checks; fixture parsing; manual provenance review.
- step-level test command:
  - `npm run pipeline:validate-catalog` (run from `source/github-repo`)
  - `npm run pipeline:test` (run from `source/github-repo`)
- Done when: each Release 1 candidate dataset has allowed/forbidden use, coverage, grain, CRS, and authoritative source recorded.

### Step A2: Pipeline foundation and contracts

- status: `completed`
- Targets: `source/github-repo/pipeline/`, `source/github-repo/data/contracts/`, `source/github-repo/data/catalog/`, `source/github-repo/pipeline/tests/`.
- Work: replace the deferred pipeline placeholder with reproducible environment/setup, source adapters, ODCS-inspired contracts, and test fixtures.
- Tests: parser unit tests; contract validation; failure tests for missing columns, dates, CRS, and invalid counts.
- step-level test command:
  - `npm run pipeline:test` (run from `source/github-repo`)
  - `npm run pipeline:validate-catalog` (run from `source/github-repo`)
- Done when: raw-to-staged parsing either produces a validated typed result or fails with a clear error.

### Step A3: Measure specification and claim boundary

- status: `completed`
- Targets: `docs/methods/`, `source/github-repo/pipeline/`, `source/github-repo/tests/`.
- Work: define approved descriptive measures, comparison windows, units, denominators, aggregation rules, and limitation copy; explicitly retire the synthetic counterfactual path for Release 1.
- Tests: measure fixtures; denominator/period tests; claim-lint tests.
- step-level test command:
  - `npm run pipeline:test` (run from `source/github-repo`)
- Done when: every planned UI metric has a method spec and no unsupported “expected” or causal value can be generated.

### Step A4: Build versioned public release assets

- status: `completed`
- Targets: `source/github-repo/data/releases/`, `source/github-repo/pipeline/`, `source/github-repo/public/data/`.
- Work: generate traffic, MTA, CRZ, DAC/context assets, a release manifest, quality report, checksums, and changelog from approved curated data.
- Tests: deterministic build; manifest schema; asset-size budget; source-ID coverage; no-synthetic-data gate.
- step-level test command:
  - `npm run pipeline:validate-catalog && npm run pipeline:test` (run from `source/github-repo`)
  - `npm run lint && npm run build` (run from `source/github-repo`)
  - `python3 scripts/release_acceptance.py` (run from `source/github-repo`)
- Done when: a complete, small, browser-safe release can be built from raw inputs and its lineage is inspectable.

### Step A5: Replace the frontend demo data boundary

- status: `completed`
- Targets: `src/lib/dataManifest.ts`, `src/types/demo.ts`, `src/hooks/useManifestDataset.ts`, `public/data/manifest.json`, tests under `tests/frontend/`.
- Work: introduce runtime validation and release-aware loading; remove production dependency on `DemoData` and synthetic effects; preserve explicit error and empty states.
- Tests: valid/invalid/synthetic manifest tests; loading/error integration tests; `npm run lint`, `npm run test`, `npm run build`.
- step-level test command:
  - `npm run lint && npm run test && npm run build` (run from `source/github-repo`)
- Done when: the SPA cannot render a production view from synthetic demo data.
- Completed evidence (Agent 2, 2026-09-16 02:15 UTC): `src/lib/releaseManifest.ts` validates the documented released-asset contract and rejects synthetic/demo/raw/non-4326/unvalidated assets; `src/lib/dataManifest.ts`, `src/types/demo.ts`, and `src/hooks/useManifestDataset.ts` were replaced by `src/lib/devSyntheticDataset.ts`, `src/types/devSynthetic.ts`, and `src/hooks/useReleaseManifest.ts`; `public/data/manifest.json` is now an explicit `status: "unpublished"` pointer; fixed borough vulnerability weights and the synthetic `expected` baseline UI were removed from the production path. Evidence: lint clean; full `npm run test` 11 files / 41 tests pass, of which this lane's 8 frontend files contribute 36 tests (baseline 13 in 4 files); production build passes; `dist/data` contains only `manifest.json`; production build refuses `VITE_USE_DEMO_DATA=true`; and `npx vite preview` serves `/data/demo/dev-manifest.json` as SPA-fallback HTML rather than a fixture.
- Open dependency: A6 module wiring still needs Agent 1's A2-A4 release assets, plus confirmation of two manifest fields not spelled out in the docs (per-asset `kind`/`format`, optional `policy_reference_date`), recorded in `coordination/agents/AGENT_2_LOG.md`.

### Step A6: Build evidence modules and state model

- status: `completed`
- Targets: `src/features/`, `src/domain/`, `src/components/Map/`, `src/state/`, `tests/frontend/`.
- Work: implement module-specific traffic, crossings, CRZ, and DAC/historical-context views with URL state, source cards, coverage labels, and limitations.
- Tests: unit tests for filters/state; integration tests for source/method rendering; keyboard and reduced-motion checks.
- Done when: each PRD module loads only its approved assets and exposes its evidence boundary.

### Step A7: Performance and accessibility hardening

- status: `in_progress`
- Targets: map asset loader/layers, CSS, E2E tests, performance budget configuration.
- Work: measure assets and chunk MapLibre data; simplify/split/cluster when necessary; add accessible controls, focus behavior, responsive layout, and deep-link tests.
- Tests: production build size review; Playwright workflow/accessibility tests; manual network-throttled check.
- Done when: the documented performance/accessibility thresholds pass on the publication candidate.

### Step A8: Firebase target correction and preview delivery

- status: `in_progress`
- Targets: `.firebaserc`, `firebase.json`, deployment documentation, CI workflow if approved.
- Work: verify project ownership, correct the target only after review, deploy preview Hosting, validate app/manifest URLs, then promote/rollback according to release approval.
- Tests: Firebase project/site verification; preview HTTP checks; build + deploy logs; post-deploy smoke test.
- Done when: the confirmed public site serves the approved release with correct cache behavior.

### Step A9: Submission proof and final review

- status: `completed`
- Targets: `docs/submission/`, release notes, methods page, final plan log.
- Work: compile source list, methods, limitations, screenshots/demonstration script, release ID, test evidence, and known gaps.
- Tests: PRD acceptance checklist; independent reproduction from a clean checkout; final frontend/pipeline/deploy checks.
- Done when: a judge can understand, run, inspect, and verify the product without undocumented context.

## Risks and decision gates

| Risk | Gate |
|---|---|
| Treating modeled/historical data as current impact evidence | Claim-lint and methods review before asset publication. |
| Undocumented prepared CSV transformations | No production asset until raw inputs and recipe are registered. |
| Firebase singular/plural project mix-up | No deploy until reviewed CLI/site verification confirms the target. |
| Raw GIS/data payloads harm map performance | Asset-size gate and measured MapLibre profiling before publication. |
| Scope grows into realtime/causal-platform complexity | ADR required for backend, realtime, or causal-analysis additions. |

## Regression matrix

- Data: parser/contract/release validation must pass for every release.
- Frontend: `npm run lint`, `npm run test`, `npm run build`.
- E2E: module navigation, source visibility, URL state, keyboard flow, error state.
- Deployment: Firebase preview URL returns the SPA and current manifest; production promotion is manually reviewed.

## 4. Execution Log

- 2026-09-15
  - Step A0: `completed`
    - Evidence: repository baseline clean; lint/test/build passed; source/archive audit completed; research recorded in `docs/research/2026-09-15_delivery_research.md`.
    - No application, Firebase, or source-data implementation change was made by this planning step.
  - Steps A1–A4 (data and pipeline, Agent 1 lane): `completed` — recorded after takeover, verified from disk
    - A1: `data/catalog/sources.yaml` registers every retained source with SHA-256, authoritative URL, coverage, grain, CRS, allowed uses, and forbidden claims. DOT CRS resolved to EPSG:2263 from LION metadata; MTA plaza mapping 21–30 resolved from authority metadata.
    - A2/A3: `pipeline/` contains source adapters, contracts, geospatial and measure-spec modules, fixtures, and tests; `pipeline/methods/release-1.yaml` defines both approved measures and records each excluded asset kind with its reason.
    - A4: release `2026-09-16.1` built with manifest, quality report, README, and two assets. Rebuild from registered raw inputs reproduces the published assets byte for byte.
    - Evidence: `npm run test` (pipeline tests included) and the determinism check recorded in `docs/submission/RELEASE_EVIDENCE.md`.
  - Steps A5–A9: `completed` / `in_progress` after takeover — recorded by Agent 3
    - A5 `completed`: the release pointer is generated, the demo manifest is confined to the development flag, and a missing/invalid manifest renders a failure state with no fallback content.
    - A6 `completed`: `TRAFFIC` and the new `CROSSINGS` module fetch, checksum-verify, validate, and render the two published assets, each with source/method/limitation detail. Previously the app validated the manifest but fetched neither asset.
    - A7 `in_progress`: reduced-motion and accessible states are implemented; no automated accessibility gate or E2E suite exists yet. MapLibre chunk remains >500 kB.
    - A8 `in_progress`: `.firebaserc` corrected and verified against the Firebase CLI; cache policy corrected; release acceptance gate green (24/24). **No preview channel and no production deploy have been run.**
    - A9 `completed`: submission package written in `docs/submission/`.
    - Evidence: `npx tsc -b` clean; `npm run lint` no findings; `npm run test` 19 files / 94 tests passed; `npm run build` clean; `python3 scripts/release_acceptance.py` 24 checks passed / 0 failed; `python3 visualization/kepler/validate_kepler_export.py` 34 checks passed / 0 failed.
  - Branch note: all implementation work sits uncommitted on `release-1-evidence-modules` in `source/github-repo/`. No commits were made.
  - Remaining gaps are listed in `docs/submission/KNOWN_GAPS.md`; deployment is gated on owner approval.
- 2026-09-16 (Agent 2, Product Frontend)
  - Step A5: `completed`
    - Changed: added `src/lib/releaseManifest.ts`, `src/hooks/useReleaseManifest.ts`, `src/hooks/useReleaseBoundary.ts`, `src/components/Detail/ModuleUnavailable.tsx`, `src/components/Status/DataRibbon.tsx`, `src/components/Map/mapConfig.ts`, `src/components/Map/mapOverlay.ts`; replaced `src/lib/dataManifest.ts`/`src/types/demo.ts`/`src/hooks/useManifestDataset.ts` with `src/lib/devSyntheticDataset.ts`/`src/types/devSynthetic.ts`/`src/hooks/useReleaseManifest.ts`; removed `src/components/Detail/EquityPanel.tsx` and the fixed borough vulnerability weights; rewrote `App.tsx`, `SourcesPanel.tsx`, `MethodologyModal.tsx`, `NarrativeOverlay.tsx`, `sourceMessaging.ts`, the prototype panels, `state/appStore.ts` defaults, `vite.config.ts`, `.env.example`, `public/data/manifest.json`, `README.md`.
    - Verified (this session, repository `source/github-repo`): `npm run lint` clean; `npm run test` 34 passed / 7 files (baseline 13); `npm run build` succeeded; `dist/data` contains only `manifest.json`; `VITE_USE_DEMO_DATA=true npx vite build --mode production` fails with `Production builds cannot run with VITE_USE_DEMO_DATA=true.`; vite preview returns SPA fallback HTML for the pruned demo path; vite dev with the flag serves `application/json` for `/data/demo/dev-manifest.json`.
    - Not verified: in-browser rendering, keyboard flow, and responsive layout (plan step A7 E2E); no browser inspection was performed.
    - Note for other lanes: `package.json`/`package-lock.json` (a `yaml` dev dependency was added and the lockfile shrank by ~468 lines) and `.firebaserc` (`tollshallows` → `tollshallow`) changed outside this lane; Agent 2 did not author those edits, but the verified frontend checks above ran against them.
- 2026-09-16 (Agent 1, Data and Pipeline)
  - Step A1: `completed`
    - Evidence: `data/catalog/sources.yaml` has 11 retained inputs with checksum, authoritative source, source semantics, CRS, coverage, and claim bounds. `npm run pipeline:validate-catalog` and `npm run pipeline:test` passed.
  - Step A2: `completed`
    - Evidence: streaming DOT/MTA parsers, ODCS-inspired contracts, fixtures, and negative cases added. All raw MTA rows validate; DOT records the single invalid negative-volume sentinel rather than coercing it.
  - Step A3: `completed`
    - Evidence: `pipeline/methods/release-1.yaml` permits only two descriptive measures; its test rejects non-descriptive claim policy. `npm run pipeline:test` passed.
  - Step A4: `completed`
    - Evidence: release `2026-09-16.1` contains 308 DOT EPSG:4326 features and 8,352 MTA daily records; public/canonical assets have matching checksums. `npm run pipeline:validate-catalog`, `npm run pipeline:test`, `npm run lint`, `npm run build`, and `python3 scripts/release_acceptance.py` passed (22 release-gate checks). The shared test suite has one known stale Agent 2 empty-state assertion awaiting that lane's update.
