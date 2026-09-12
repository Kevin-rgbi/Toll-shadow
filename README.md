# The Toll Shadow

The Toll Shadow is an investigative web map that compares observed post-policy
traffic and air quality patterns with expected no-toll patterns, with a focus on
where burden may have shifted.

Detailed project planning and phased delivery live in PLAN.md.

## Current Status

The current build is a frontend-first scaffold with synthetic data.

Implemented now:
- Full-screen NYC map shell with MapLibre + OpenStreetMap (no API key)
- Canvas-rendered traffic corridors and monitor markers
- D3-based visual encodings for effect, confidence, and scale
- Timeline playback with requestAnimationFrame
- Global app state with Zustand
- Manifest-driven data loading for demo and future export paths
- Compare toggle and map feature hover/click selection
- Unit tests for store behavior, interpolation, and visual encoding logic

Not implemented yet:
- Real ingestion and modeling pipeline outputs
- Production data sources and validated geographies
- Full narrative scrollytelling and hotspot explorer stack

## Architecture

- React and TypeScript: application shell and UI
- Zustand: shared app state
- MapLibre GL JS: map camera and geographic projection
- OpenStreetMap tiles: keyless basemap source with attribution
- Canvas: high-performance synthetic map marks
- D3: scales and interpolation helpers
- Firebase Hosting: static deployment target

## Data Flow

1. App loads public/data/manifest.json
2. Manifest file paths are resolved for effects and geography
3. Effects can be loaded as a single file or by period
4. Timeline date drives interpolation across period effects
5. Interpolated values are rendered on the canvas overlay

## Local Development

Install dependencies:
- npm install

Run dev server:
- npm run dev

Run lint:
- npm run lint

Run tests:
- npm run test

Build for production:
- npm run build

## Project Structure

- src: frontend application code
- public/data: manifest and demo assets
- tests/frontend: unit tests for frontend logic
- pipeline: deferred ingestion and modeling workflow

## Scope Guardrails

In scope for this phase:
- Detect and visualize where traffic and air patterns changed
- Compare observed and expected patterns without overclaiming causality
- Surface confidence and uncertainty visually
- Identify areas that need deeper investigation

Out of scope for this phase:
- Designing physical interventions
- Prescribing urban redesign solutions
- Claiming singular causation without robustness evidence

## Notes

- The current visualization uses synthetic values for development.
- Synthetic data is explicitly labeled in the interface.
- Build may report a non-blocking chunk size warning during bundling.
