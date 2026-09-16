# Delivery Research Brief

## Scope and method

This brief was prepared before implementation. It combines direct inspection of the current Toll Shadow code/data bundle, official source documentation, comparable live products, and reusable open-source repositories. Research was read-only.

Reddit research was attempted through the configured Agent Reach/OpenCLI route. The adapter returned no content because no authenticated Reddit browser connection is available in this session. Reddit is therefore not used as evidence in the decisions below; it remains a future research task after the user connects the browser adapter.

## Findings that change the plan

1. **Build an evidence product before a causal product.** C2SMART's live tracker keeps distinct measures separate (camera density, crossings, speeds, bus speeds) and carries an explicit public-data disclaimer. Toll Shadow should do the same: show what each source measures, its timing, and its limits rather than collapse everything into one claimed “effect.”

2. **Keep data grain intact.** The MTA CRZ source is weekly-posted, 10-minute, crossing-by-vehicle-class data. The archive's 12-row CRZ file is a convenience summary, not a replacement for the source grain. Published aggregates must retain a link to their source window and aggregation recipe.

3. **Historical health and air data are context, not treatment outcomes.** The archive's asthma data ends in 2019. NYCCAS rasters model 2008-2019 surfaces at 300 m from land-use regression and explicitly are not short-term local or regulatory monitoring. Neither can prove a 2025 congestion-pricing effect.

4. **A static-first architecture is the correct first deployment.** Firebase Hosting is a CDN for static and SPA assets and supports preview channels. The current use case has versioned public data, no authenticated users, and no required write path. A backend should be introduced only for a confirmed refresh cadence, protected data, or server-side query need.

5. **Published map assets need a performance budget.** MapLibre recommends URL-loaded data, size reduction, chunking, clustering, and tiles for larger GeoJSON. The 287 MB raw DOT CSV and 332 MB archive must never become direct browser assets.

6. **Do not copy a whole comparable project's architecture.** The MIT-licensed Django reference is useful for its explicit ingestion model and schema, but its real-time/server design is unnecessary now. The MIT Streamlit taxi dashboard is useful for aggregation/filter behavior, but loading the full dataset in the UI is not a production pattern for Toll Shadow. The Columbia project is a good communication reference, but has no declared code license and must not be copied.

## Comparable projects

| Reference | What it demonstrates | What Toll Shadow adopts | What it rejects |
|---|---|---|---|
| [C2SMART Manhattan Congestion Tracker](https://c2smart.engineering.nyu.edu/manhattan-congestion-tracker/) | A live public tracker separates crossing, camera-density, speed, and bus-speed measures and publishes a disclaimer. | Separate evidence modules, source-specific labels, caveats. | A claim that multiple sources equal one causal result. |
| [mkturkcan/congestionpricing](https://github.com/mkturkcan/congestionpricing) | A focused public narrative, explicit before/after window, and listed measurement limitations. | Limitation-first results writing and a concise public story. | Code reuse: repository has no declared license. |
| [liamjdavis/Cubist-Hackathon-2025](https://github.com/liamjdavis/Cubist-Hackathon-2025) | Explicit data model, batch CSV import, dashboard/map separation; MIT license. | A typed normalized event/aggregate model and batch ingestion boundaries. | Django, WebSockets, and “live” claims until a real streaming source is approved. |
| [hessamasadi/nyc-taxi-dashboard-2025](https://github.com/hessamasadi/nyc-taxi-dashboard-2025) | Zone-level aggregation, filters, quality-report messaging; MIT license. | Pre-aggregate before the UI, expose filters and source caveats. | Loading a full large dataset directly in the browser. |

## Authoritative source findings

| Source | Verified fact relevant to this project |
|---|---|
| [MTA CRZ Vehicle Entries](https://data.ny.gov/Transportation/MTA-Congestion-Relief-Zone-Vehicle-Entries-Beginni/t6yz-b64h/about_data) | Grain is 10-minute interval x crossing x vehicle class; posting frequency is weekly; the dataset should not be used for revenue calculations. |
| [NYCCAS Air Pollution Rasters](https://data.cityofnewyork.us/Environment/NYCCAS-Air-Pollution-Rasters/q68s-8qxv/about_data) | Annual NO2/PM2.5/BC/NO, summer O3, and winter SO2 modeled surfaces; ESRI GRID at 300 m, NAD83 NY Long Island State Plane feet; modeled 2008-2019 values are not short-term/local regulatory monitoring. |
| [NYS DAC Criteria](https://climate.ny.gov/resources/disadvantaged-communities-criteria/) | DAC criteria changed to Version 2.0 in 2025. The archive's 1,736-feature file aligns with the 2023-era count and needs an explicit version decision before publication. |
| [MapLibre large-data guide](https://maplibre.org/maplibre-gl-js/docs/guides/large-data/) | Use URL-loaded data, reduce/split GeoJSON, cluster points, and use vector tiles only when the measured asset budget requires them. |
| [Firebase Hosting](https://firebase.google.com/docs/hosting) | Static/SPAs deploy to a CDN with preview channels and rollback; functions or Cloud Run are optional for dynamic requirements. |
| [Open Data Contract Standard](https://github.com/bitol-io/open-data-contract-standard) | Versioned machine-readable contracts can express schema, quality, lineage, ownership, and SLAs. |

## Architecture conclusion

The first production architecture is:

```text
authoritative downloads -> immutable raw files -> validated transforms -> versioned published assets
                                                                  -> provenance + quality reports
versioned published assets -> React/TypeScript + MapLibre SPA -> Firebase Hosting preview -> production Hosting
```

The pipeline is the source of truth. Firebase Hosting serves only the built SPA and published, bounded public assets. There is no Firestore, Realtime Database, or Cloud Function in Release 1.

## Open questions that block later claims, not planning

- What exact policy cutoff and comparison design is approved for each metric?
- Which source version should be cited for raw DOT counts at the time of the first public release, and has its source schema changed since this archive download?
- Which source version should be cited for the MTA daily aggregate at the time of the first public release, and has its source schema changed since this archive download?
- Which DAC release is the project allowed to show: archived 2023, current Version 2.0, or both with labels?
- Is the application a descriptive public explainer only, or is a formal causal estimate a required deliverable?
- Who owns refreshes and signs off on data releases?
