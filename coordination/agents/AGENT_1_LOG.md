# Toll Shadow Agent 1 Log: Data and Pipeline

**Owner:** Agent 1

## Purpose

This is the required work log for the data and pipeline lane. Read this file at session start, update it before and after each meaningful phase, and keep working until the assigned phase is verified or a concrete dependency is recorded. Do not use it as a substitute for reading the project materials below.

## Mandatory Context Read Order

1. `../../AGENTS.md`
2. `../../docs/PRD.md`
3. `../../docs/DATA_STRATEGY.md`
4. `../../docs/ARCHITECTURE.md`
5. `../../docs/TECHNICAL_DESIGN_DOCUMENT.md`
6. `../../docs/ENGINEERING_PLAN.md`
7. `../../docs/TOLL_SHADOW_MHC_EVENT_AUDIT.md`
8. `../../plan/2026-09-15_21-46-00_evidence_product_delivery.md`
9. The current Agent 2 and Agent 3 logs in this directory.

The organized workspace is the project context. `../../source/github-repo/` is a preserved GitHub working copy; `../../data/raw/` contains immutable originals; `../../data/processed/` contains unverified legacy/Kepler-ready derivatives; `../../visualization/kepler/` contains the Kepler project; and `../../docs/` is the approved product/design context. Never overwrite original data, move files, reset Git, or silently delete/quarantine content.

## Shared Non-Negotiables

- Release 1 is an evidence product, not a causal policy-impact claim.
- No synthetic demo values, fixed borough vulnerability scores, assumed CRS, or undocumented aggregation in the production path.
- Historical NYCCAS and asthma data are context only, never 2025 health/air outcomes.
- Browser assets must be generated, bounded, EPSG:4326 when spatial, and traceable through a versioned release manifest.
- The production map is React plus MapLibre. Kepler is a reproducible research and visual-QA artifact, never the live runtime.
- Preserve source provenance, checksum inputs, limitations, and validation failures. Failed checks block publication.
- Use `apply_patch` for edits, run focused fresh tests, and log actual command outcomes only.

## Ownership and Boundary

**Own:** `../../data/catalog/`, `../../source/github-repo/data/contracts/`, `../../source/github-repo/pipeline/`, pipeline tests/fixtures, generated releases, and data-method documentation.

**Do not edit:** `../../source/github-repo/src/` (Agent 2), Firebase configuration/deployment automation (Agent 3), or another agent's assigned log except to read it. Coordinate any manifest-schema change with Agent 2 before writing browser-facing output.

## Current Assignment

Implement plan steps A1 through A4 in order, beginning with source provenance closure and an ODCS-inspired, testable raw-to-published pipeline. The first release must use only sources whose spatial, temporal, and semantic limitations are recorded. Legacy Kepler CSVs may be validated as inputs/reference but cannot become untested release assets merely because they render.

### Known Verified Facts

- DOT source is NYC Open Data `7ym2-wayt`; raw WKT is tied to LION `SegmentID`. NYC Planning LION metadata establishes EPSG:2263 (NAD83 / New York Long Island feet).
- MTA daily source is NY Open Data `fcbp-umit`, a daily aggregate view of hourly crossings. Its official metadata maps plaza IDs 21-30 and defines I/O directions.
- CRZ source is NY Open Data `t6yz-b64h`; its grain is 10-minute interval x crossing x vehicle class. The 12-row archive summary is contextual only.
- MTA CBD taxi zone source is `yfdc-w5jh`; archive CSV is a 38-row derivative and `query.csv` is a PDF source snapshot.
- NYS DAC source is `2e6c-s6fp`; archive data is 2023-era and cannot be labeled current after the 2025 Version 2.0 criteria update without a deliberate release decision.
- NYCCAS source is `q68s-8qxv`; 300 m modeled surfaces are historical context, not local regulatory monitoring.

## Running Status

| UTC time | Phase | Status | Evidence / next action |
|---|---|---|---|
| 2026-09-15 | A1: source register | in progress | Raw MTA mapping and DOT CRS were independently verified from authoritative metadata. Create machine-readable register, then validate checksums and source schema. |
| 2026-09-16 | A1: source register | completed | Added 11-entry source register with paths, checksums, source semantics, CRS, allowed use, and forbidden claims. Ruby YAML parsing plus Python path/checksum validation passed. |
| 2026-09-16 | A2: pipeline foundation | in progress | Lock browser manifest schema with Agent 2's documented contract and add a testable catalog/contract parser. |
| 2026-09-16 | A3: measure specification | completed | Defined two descriptive, source-specific Release 1 measures and a policy date as timeline metadata only. Spec validation rejects non-descriptive claim policies. |
| 2026-09-16 | A4: versioned release | completed | Built `2026-09-16.1`, validated its browser manifest, checksum parity, asset budget, and release-acceptance gate. |
| 2026-09-16 | A4: frontend handoff | waiting on Agent 2 test update | Release manifest loads successfully as `ready`; one frontend test still expects the earlier explicit `unpublished` pointer. |

## Completion Handoff Template

Append a row and concise notes after each completed phase:

```text
### Phase A?-<name> completed — YYYY-MM-DD HH:MM UTC
Changed:
Verified:
Commands and results:
Release/contract impact:
Open dependency or next phase:
```

### Phase A1-source-register completed — 2026-09-16 02:55 UTC
Changed: Added `data/catalog/sources.yaml` and catalog guidance; updated resolved CRS/MTA semantics in `docs/DATA_STRATEGY.md` and the research brief.
Verified: 11 register entries parse as safe YAML; every recorded file path exists; every file checksum in the register matches the retained source.
Commands and results: Ruby catalog validation passed; Python path/checksum validation passed.
Release/contract impact: Only `approved_for_pipeline` raw DOT and MTA sources may enter the first parser. Legacy Kepler tables remain reference-only; DAC and historical context stay gated.
Open dependency or next phase: A2 contract/parser implementation is active. The DAC release choice remains owner-gated.

### Phase A2-pipeline-foundation completed — 2026-09-16 03:20 UTC
Changed: Replaced the deferred pipeline placeholder with YAML-backed source/contract validation, streaming CSV readers, DOT and MTA normalizers, fixtures, and seven focused tests.
Verified: All 98,053 raw MTA rows validate. DOT streams through 1,367,019 rows before correctly rejecting the archived negative-volume sentinel; optional blank street endpoint labels are preserved as null rather than inferred.
Commands and results: `npm run pipeline:validate-catalog` passed; `npm run pipeline:test` passed with 7 tests.
Release/contract impact: Agent 2 may consume the release contract's `kind`, `format`, and optional `policy_reference_date`; MTA asset kind is `facility_crossings` to match the frontend validator.
Open dependency or next phase: A3/A4 in progress; Release 1 only includes raw-sourced DOT and MTA outputs.

### Phase A3-measure-specification completed — 2026-09-16 03:25 UTC
Changed: Added machine-readable and human-readable Release 1 measure definitions.
Verified: Measure-spec tests accept the two declared descriptive measures and reject a non-descriptive claim policy.
Commands and results: `npm run pipeline:test` passed with 7 tests; `npm run pipeline:validate-catalog` passed.
Release/contract impact: DOT is a sampled monthly segment measure and MTA is a daily facility measure. 2025-01-05 is a timeline marker only; CRZ, CBD, DAC, asthma, and NYCCAS remain excluded.
Open dependency or next phase: Build A4 release assets and hand the final manifest to Agent 2.

### Handoff to Agent 2 — 2026-09-16 03:35 UTC
Release `2026-09-16.1` is now at `source/github-repo/public/data/manifest.json`. Its manifest parsed successfully through `loadReleaseManifest` as a validated `ready` release. Assets are `/data/releases/2026-09-16.1/traffic_observations.geojson` (308 EPSG:4326 point features) and `/data/releases/2026-09-16.1/facility_crossings.json` (8,352 daily records). The frontend vocabulary is `traffic_observations` and `facility_crossings`; `policy_reference_date` is `2025-01-05` and is timeline metadata only. Update `tests/frontend/shippedManifest.test.ts` from the former expected empty/unpublished state to the validated release assertion, then run the shared suite. Do not add implied causal comparison UI.

### Phase A4-versioned-release completed — 2026-09-16 03:45 UTC
Changed: Added the immutable `2026-09-16.1` release generator, canonical release files, public assets, manifest, quality report, checksums, and release README. Updated the published-asset contract to require `kind`, `format`, and release-owned policy metadata.
Verified: DOT output has 308 EPSG:4326 GeoJSON point features from 177,571 included 2024-2025 observations. MTA output has 8,352 validated daily records. Asset sizes are 229,212 bytes and 2,890,818 bytes, below the 5 MiB per-asset budget. Canonical/public checksums match. Agent 3's release gate passed 22 checks with zero failures.
Commands and results: `npm run pipeline:validate-catalog` passed; `npm run pipeline:test` passed with 9 tests; `npm run lint` passed; `npm run build` passed with the pre-existing MapShell chunk warning; `python3 scripts/release_acceptance.py` passed 22/22. The full shared test suite has one expected integration failure because Agent 2's old shipped-manifest test still expects `unpublished`; handoff recorded above.
Release/contract impact: The browser can now consume a validated static release. DOT is `traffic_observations`; MTA is `facility_crossings`; `policy_reference_date` is `2025-01-05` timeline-only metadata. CRZ, CBD, DAC, asthma, and NYCCAS remain absent by design.
Open dependency or next phase: Agent 2 updates the former empty-state test and wires only the approved module assets. Agent 3 can rebuild, run its release gate, apply reviewed cache policy, and deploy a Firebase preview -- never the plural project.
