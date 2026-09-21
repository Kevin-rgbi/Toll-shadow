# Acceptance traceability

Every Release 1 PRD condition, with the test or release check that proves it. This is the engineering
plan's "definition of done" item that was missing until now: previously no FR was mapped to evidence.

Run everything below with:

```bash
npm run test                                  # 173 tests, includes the accessibility gate
npm run lint
npx tsc -b
npm run build
python3 scripts/release_acceptance.py          # 49 checks
python3 visualization/kepler/validate_kepler_export.py
```

CI (`.github/workflows/verify.yml`) runs the same set on every push to `main` and every pull request.

| FR | Condition | Evidence | Status |
|---|---|---|---|
| FR-01 | Load a versioned manifest before any data view; fail clearly when missing, malformed, or invalid | `tests/frontend/releaseManifest.test.ts`, `tests/frontend/shippedManifest.test.ts`; gate checks pointer caching, schema, status | Met |
| FR-02 | Landing view names the window and the evidence boundary, with no synthetic, "expected", or causal language | `tests/frontend/moduleStates.test.ts` asserts the absence of causal/expected wording; `sourceMessaging.CLAIM_GUARDRAIL`; story view copy | Met (claim-lint is by test, not by a copy scanner) |
| FR-03 | Traffic module with filters, date range, grain, sample fields, source link | `tests/frontend/trafficSummary.test.ts`, `moduleStates.test.ts`, `releaseData.test.ts`; module renders `AssetProvenance` | Met |
| FR-04 | MTA crossings module with **named** facilities, directions, and the MTA caveat | `tests/frontend/crossingsSummary.test.ts`, `moduleStates.test.ts` (name plus published identifier); `pipeline/tests/mta.test.mjs` naming rules; all 8,352 published records named | Met |
| FR-05 | CRZ-entry module with aggregation window and coordinate-precision label | `tests/frontend/crzSummary.test.ts`, `releaseData.test.ts` (`parseCrzEntries`), `moduleStates` a11y surface; `pipeline/tests/release.test.mjs` covers the asset; module states areas-not-points | Met |
| FR-06 | Equity/context module: DAC geography and historical air/health context with release year and non-causal labels | Assets not yet published; `crz_context` removed from the excluded list but `dac_context` and `historical_context` remain excluded in `pipeline/methods/release-1.yaml` | **Not met** |
| FR-07 | Every module exposes source URL, coverage, grain, transform version, and limitations | `AssetProvenance` is rendered by all three live modules; `moduleStates.test.ts` asserts "Source and method" and a limitation line | Met |
| FR-08 | URL encodes the selected module and supported filter state | `tests/frontend/viewState.test.ts`, including build identity and renderer choice round-trip | Met |
| FR-09 | Keyboard, focus, reduced motion, and an **automated accessibility gate** | `tests/frontend/accessibility.test.tsx`: six surfaces, zero serious or critical violations, plus a negative test proving axe reports real violations | Met |
| FR-10 | Deployable through a preview channel before production | Production serves the older verified `2026-09-16.2`; the `2026-09-18.1` AIR candidate passes the release gate and must still follow `docs/deployment/HOSTING_PREVIEW_ROLLBACK_RUNBOOK.md` before deploy | Met for deployability; candidate not promoted |

## PRD success metrics

| Metric | Evidence | Status |
|---|---|---|
| 100% of public data assets have manifest entries, SHA-256, source reference, coverage, status | Gate refuses an asset without a checksum; manifest published with all declared assets, including the AIR CSVs | Met |
| 0 synthetic records in production assets; **CI** blocks `synthetic: true` | Gate blocks it, and the workflow now runs the gate on push and PR | Met |
| 100% of displayed metrics have a source/method link | `AssetProvenance` in every module | Met |
| Initial payload inside the defined performance budget | The gate measures gzipped entry and map chunks, and `dist/data` is 45,890,466 bytes against the 64 MiB AIR-aware budget | Met |
| All blocking acceptance tests pass before a production deploy | Gate run before each deploy; CI enforces on push | Met |

## Known gaps that remain outside the FR list

- FR-06's DAC and historical-context assets are unwritten (see above). AIR publishes preliminary
  observed PM2.5 monitor measurements, not historical raster context or a causal air-quality claim.
- No end-to-end browser suite; module switching and the mobile sheet are verified by unit tests and by
  browser checks recorded in the work log, not by Playwright.
- Production runs with no uptime or error monitoring, recorded as an owner decision.
- No independent human review of the code or the data.
