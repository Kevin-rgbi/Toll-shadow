# Toll Shadow — Submission Evidence Package

**Release under review:** `2026-09-16.2`
**Application:** React + TypeScript + MapLibre SPA, static-first, hosted on Firebase Hosting
**Deployment status:** not deployed. A preview channel is gated on owner approval; production promotion requires a separate approval.

This package exists so a reviewer can understand, run, inspect, and verify the product without undocumented context. It is written to be checkable, not persuasive: every number below is produced by a command whose output is quoted in `RELEASE_EVIDENCE.md`.

## What the product claims, and what it does not

Toll Shadow is an evidence explorer for New York City traffic-related observations. Release 1 publishes **descriptive** aggregates and their limits.

It does **not** claim that congestion pricing caused any observed difference. It publishes no counterfactual or "expected" value, no current air-quality measurement, and no post-2025 health outcome.

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

The application repository is a separate Git checkout at `source/github-repo/`, currently on branch `release-1-evidence-modules`.

```text
source/github-repo/
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
