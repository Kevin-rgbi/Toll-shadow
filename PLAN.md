# PLAN.md - The Toll Shadow

> **Superseded in two places by the PRD, deliberately.**
>
> This is the original frontend build plan. It scopes "comparison between observed and expected
> states" and "confidence and uncertainty-aware rendering", and it says "current UI data remains
> synthetic and clearly labeled". The PRD lists expected values, counterfactual estimates, and
> synthetic data in the product as non-goals, and the architecture doc forbids dynamic expected values
> until a reviewed analysis design exists. The compare-mode surfaces exist only behind the development
> flag and never render in a production build.
>
> Everything else here still describes how the interface was built. Where this file and the PRD
> disagree, the PRD governs.

## Project Goal

Build a production-quality investigative map that answers:
Where does observed post-policy NYC diverge from what would have been expected without congestion pricing?

## Phase 1 Product Scope

In scope:
- Traffic migration patterns across NYC
- Air-quality pattern changes
- Congestion zone context and boundary display
- Confidence and uncertainty-aware rendering
- Comparison between observed and expected states
- Identification of affected areas for deeper follow-up

Out of scope:
- Designing interventions or urban redesign proposals
- Claiming definitive single-cause attribution

## Current Frontend Architecture

- React + TypeScript for app shell and UI orchestration
- Zustand for global app state
- MapLibre + OpenStreetMap tiles for basemap, camera, and projection (no API key dependency)
- Canvas overlay for high-performance synthetic marks
- D3 scales/interpolation for visual encoding and timeline effects
- Manifest-driven data loading for demo and future real exports

## Frontend Build Order

1. Foundation
- Scaffold app shell, styling baseline, map container, and hosting config
- Create typed synthetic data contracts

2. Visual Map Layer
- Render synthetic roads and monitors in canvas overlay
- Map direction to diverging colors
- Map effect magnitude and confidence to width/opacity

3. Timeline and Playback
- Bind timeline state to render interpolation
- Use requestAnimationFrame playback loop
- Respect reduced-motion behavior

4. Compare Mode
- Actual/expected visual framing and transition handling
- Preserve performance with draw-state approaches, not per-road components

5. Interaction
- Hover/click feature selection on canvas
- Detail card and focus affordances

6. Story and Analysis Views
- Story mode progression
- Confidence and equity-focused overlays
- Hotspot ranking and drill-down surfaces

## Data Contract Plan

Manifest first:
- App loads public/data/manifest.json first
- Manifest resolves paths for effects, zone, and future assets

Effects support:
- Single effects file fallback
- Period-indexed effects for timeline interpolation

Validation behavior:
- Fail loudly on missing required paths
- Keep source assumptions explicit

## Pipeline Plan (Deferred)

Pipeline directory will own ingestion, QA, modeling, uncertainty, and exports.
Frontend must not fabricate unavailable real values.
If source schemas are unknown, adapters should fail clearly with TODO markers.

## Quality Gates

After each implementation increment:
- npm run lint
- npm run test
- npm run build
- Verify no blocking browser-console/runtime errors

## Notes

- Current UI data remains synthetic and clearly labeled.
- Real-source integration is a later phase once pipeline exports are stable.
