# Toll Shadow — Submission Evidence Package

**Live release:** `2026-09-22.1`
**Application:** React + TypeScript + MapLibre SPA, static-first, hosted on Firebase Hosting
**Deployment status:** deployed to <https://tollshallows.web.app> on 2026-09-22 after preview and
production smoke checks.


This package exists so a reviewer can understand, run, inspect, and verify the product without undocumented context. It is written to be checkable, not persuasive: every number below is produced by a command whose output is quoted in `RELEASE_EVIDENCE.md`.

## What the product claims, and what it does not

Toll Shadow is an evidence explorer for New York City traffic-related observations. Release 1 publishes **descriptive** aggregates and their limits.

It does **not** claim that congestion pricing caused any observed difference. It publishes no counterfactual or "expected" value, no regulatory AQI claim, and no post-2025 health outcome. Preliminary NYCCAS values are observed monitor concentrations with explicit gaps and limitations.

The claim boundary is enforced in code, not only in copy:

- the release manifest contract rejects `synthetic: true`, unvalidated assets, non-`EPSG:4326` spatial assets, and off-origin or raw-archive asset paths (`src/lib/releaseManifest.ts`);
- every published record is re-validated in the browser before a view may use it, and internal inconsistencies (for example a crossing total that disagrees with its own components) raise rather than render (`src/lib/releaseData.ts`);
- every module renders the provenance of the asset it displays, including the source register entry, coverage, grain, transform version, and the asset's own limitations (`src/components/Detail/AssetProvenance.tsx`).

## Documents

| Document | Contents |
|---|---|
| `SOURCES_AND_METHODS.md` | Every source, its permitted use, and the measure specification behind each published asset. |
| `RELEASE_EVIDENCE.md` | Release contents, checksums, quality results, and the exact verification commands with their output. |
| `DEMO_SCRIPT.md` | A short walkthrough of the reviewer journey, with the URL state each step produces. |
| `KNOWN_GAPS.md` | What is missing, unresolved, or deliberately deferred. |

## Where the work lives

The application repository is this Git checkout. Release `2026-09-22.1` retains the unified
AIR/PM2.5, CI, CRZ, traffic, accessibility, release, and documentation work, and adds approved
source-quality, Westchester Square coverage, and observed-traffic ranking views.

```text
pipeline/            # source adapters, contract validation, release builder
data/contracts/      # ODCS-inspired published contracts
data/releases/       # versioned release output (manifest, assets, quality, README)
public/data/         # browser-facing release pointer and release assets
src/                 # React + MapLibre application
scripts/             # release acceptance gate
visualization/kepler/  # Kepler reproducibility artifact + validator
data/catalog/          # immutable source register
docs/                  # product, method, and submission documentation
```
