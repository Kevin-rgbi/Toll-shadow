# Engineering Plan

## Delivery principles

- One source of truth per concept: raw source, canonical domain model, published asset, UI module.
- One bounded change at a time: implement, run focused tests, update plan evidence, then proceed.
- Keep the static-first architecture until a documented requirement proves it insufficient.
- Frontend visual direction is deliberately deferred; this plan builds a reliable front-end foundation, not final art direction.

## P0: Truth and reproducibility

1. Establish `data/catalog/sources.yaml`, immutable raw locations, SHA-256 inventory, and source ownership/release metadata.
2. Confirm/record raw DOT CRS, MTA plaza mapping, DAC release choice, and every source's permitted/forbidden use.
3. Scaffold `pipeline/` with deterministic environment, fixtures, parser contracts, and validation report format.
4. Define the first approved observed-comparison measures and remove any requirement for unvalidated counterfactual values.

## P1: Release pipeline and application data boundary

5. Build source adapters that turn approved inputs into canonical traffic, crossings, CRZ, and context models.
6. Generate a small versioned public release, manifest, quality report, and source/method copy from pipeline metadata.
7. Replace production demo loading/types/analysis with runtime-validated release loading; preserve clear error states.
8. Implement the evidence modules and URL state from the PRD, with source and limitation detail in every module.

## P2: Hardening and delivery

9. Add accessibility, performance, claim-safety, and E2E coverage; make MapLibre assets lazy/chunked according to measured size.
10. Correct the reviewed Firebase target, deploy through preview Hosting, run release acceptance checks, and publish only after an owner signs off on data/provenance.

## Definition of done

- Every Release 1 PRD acceptance condition is linked to a test or manual release check.
- Production frontend contains no synthetic analysis assets.
- Every public asset is traceable to a versioned release and source register.
- The production URL resolves to the confirmed Firebase project and passes preview-to-live checks.
- The product makes no causal, health, or localized-air-quality claim beyond its approved evidence.
