# Technical Design Document (TDD)

## Purpose

Implement the Release 1 product described in `docs/PRD.md` through a reproducible data pipeline and a source-backed SPA. This TDD deliberately treats “TDD” as a technical design document and includes a test-driven delivery strategy.

## Existing-code integration

| Existing path | Current role | Required change direction |
|---|---|---|
| `src/lib/dataManifest.ts` | Fetches a demo manifest and effects files. | Replace demo-specific contracts with release-manifest validation and module asset loading. |
| `src/types/demo.ts` | Hard-codes `synthetic: true`. | Delete from production path after replacement contracts/tests exist. |
| `src/lib/analysis.ts` | Derives hotspot/equity values from synthetic effects and fixed borough weights. | Replace with source-backed module calculations or remove unsupported rankings. |
| `src/components/Map/MapShell.tsx` | Custom canvas overlay over MapLibre. | Retain only after it renders validated feature sources; prefer native MapLibre sources/layers for published data. |
| `public/data/manifest.json` | Points at demo assets. | Generate from a validated release manifest. |
| `pipeline/README.md` | States pipeline is deferred. | Replace with executable pipeline instructions and quality gates. |
| `.firebaserc` | Points to plural project. | Correct only after explicit project ownership verification and preview deploy test. |

## Delivery slices

1. **Data foundation:** source register, contracts, raw placement, parser fixtures, validation commands.
2. **Release builder:** source adapters, normalized tables, published asset exports, release manifest, quality report.
3. **Frontend data boundary:** runtime schema validation, loading/error states, removal of production demo dependency.
4. **Evidence modules:** traffic, MTA crossings, CRZ entries, DAC/historical context, methods/sources.
5. **Product hardening:** URL state, accessible interaction, performance budgets, preview deploy, publication review.

## Test strategy

| Layer | Tests | Failure prevented |
|---|---|---|
| Raw/parser | Fixture-based schema/date/CRS tests. | Silent source drift and malformed input. |
| Transform | Deterministic aggregate and lineage tests. | Wrong period, grouping, or denominator. |
| Contract | Required-field, range, source-ID, coverage, checksum checks. | Untraceable/misleading published data. |
| Frontend unit | Manifest parser, URL state, formatting/labels, limitation rules. | Invalid asset or claim reaching a UI module. |
| Frontend integration | Load a release fixture, select filters, inspect source/method output. | Broken data-to-view wiring. |
| Browser E2E | Keyboard flow, map/module switching, deep links, mobile viewport. | User-visible workflow regressions. |
| Deployment | Build, Hosting preview, HTTP status, release-manifest fetch. | Broken production artifact or wrong Firebase target. |

## Required test fixtures

- Minimal valid and invalid DOT traffic rows, including `Vol=-1`.
- Minimal valid and invalid MTA rows, including unknown plaza IDs.
- Valid/invalid GeoJSON geometry and CRS cases.
- A release manifest with all required data and one malformed/synthetic manifest.
- A data-release fixture that includes explicit limitations for historical asthma and NYCCAS context.

## Quality/claim gate

Before a production build, a test must fail if any of these occur:

- `synthetic: true` in a production manifest or asset.
- UI copy exposes an `expected`, `caused`, or `impact` claim without a referenced approved analysis method.
- A displayed metric lacks `source_id`, coverage, grain, and limitation metadata.
- A historical asthma/NYCCAS value is labeled as a 2025 local outcome.
- A data file exceeds the asset budget without an approved tiling/chunking plan.

## Verification commands planned

```text
# pipeline
python -m pytest pipeline/tests
python -m pipeline.validate_release --release <id>

# frontend
npm run lint
npm run test
npm run build
npx playwright test

# delivery
firebase hosting:channel:deploy <channel> --project tollshallows
curl -fsS <preview-url>/data/manifest.json
```

Commands are planned, not run as an implementation action in this document. Exact Python environment/package commands are set when the pipeline scaffold is approved.

## Rollback

- Pipeline: retain immutable raw files and prior release directories.
- Frontend: deploy only release-pinned assets; rollback by restoring the previous Hosting release/manifest pointer.
- Data: never patch a published release in place; publish a corrected version with a changelog.
