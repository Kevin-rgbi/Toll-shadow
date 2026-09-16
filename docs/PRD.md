# Product Requirements Document: Toll Shadow

## Product statement

Toll Shadow is a public, evidence-led New York City congestion-pricing explorer. It lets a reviewer understand what changed in traffic-related observations around the Congestion Relief Zone, where the data is strong or weak, and how historical environmental and equity context differs across place.

It is not a dashboard that promises a causal result the data cannot support.

## Problem

The current project has a polished synthetic frontend and real source data in separate formats, time ranges, spatial resolutions, and reliability levels. A reviewer cannot yet distinguish a real observed comparison from a generated value, locate a source, or understand what can and cannot be concluded.

## Target users

- A competition judge or civic-data reviewer who needs a clear, defensible story quickly.
- A NYC resident or journalist who needs a trustworthy, explorable public explanation.
- A research collaborator who needs reproducible inputs, outputs, and limitations.

## Release 1 outcome

A deployed public SPA with only validated published data, source-linked visualizations, a clear observed-comparison story, an accessible methodology surface, and a reproducible build/data-release process.

## Goals

- Make the difference between source observation, derived aggregate, historical context, and unsupported inference visible.
- Let a user inspect traffic and crossing measures by period, location, direction/facility, and source.
- Show the CRZ boundary and DAC context without implying that DAC status causes a transport result.
- Make every displayed metric traceable to a versioned data-release manifest.
- Make the app reliable on desktop and mobile networks without loading raw archival files.

## Non-goals for Release 1

- A formal counterfactual/causal estimator, “expected” traffic values, or causal health claim.
- Real-time data, notifications, authentication, user accounts, or a data-entry workflow.
- Direct rendering of raw DOT traffic, raw MTA data, the ArcInfo GRID tree, or county-level asthma records as local outcomes.
- A final visual-art direction. Visual design is a later, separately researched workstream.

## Core user journey

```text
Open app -> see what the product measures -> choose an evidence module -> filter period/place
-> inspect map/chart -> open source and method -> understand limit -> share a stable URL/state
```

## Functional requirements

| ID | Requirement | Acceptance condition |
|---|---|---|
| FR-01 | Load a versioned public release manifest before any data view. | App fails clearly when the manifest is missing, malformed, or marked invalid. |
| FR-02 | Present a landing/story view that names the data window and evidence boundary. | No synthetic, “expected,” or causal language appears in the Release 1 product copy. |
| FR-03 | Provide a traffic observation module. | User can filter valid prepared traffic aggregates and see date range, grain, sample/observation fields, and source link. |
| FR-04 | Provide an MTA crossings module. | User can compare named facilities/directions across valid periods and see the MTA source caveat. |
| FR-05 | Provide a CRZ-entry module. | User can inspect source-backed CRZ summaries with their aggregation window and coordinate precision label. |
| FR-06 | Provide an equity/context module. | User can view DAC geography and historical air/health context with release year and non-causal labels. |
| FR-07 | Provide source and methodology detail. | Every module exposes source URL, coverage, grain, transform version, and limitation text. |
| FR-08 | Support a stable shareable view state. | URL encodes the selected module and supported filter state. |
| FR-09 | Be accessible and responsive. | Keyboard navigation, visible focus, reduced-motion support, and an automated accessibility gate pass. |
| FR-10 | Be deployable through a preview channel before production. | The built SPA, manifest, and static assets load successfully from Firebase preview Hosting. |

## Success metrics

- 100% of public data assets have manifest entries, SHA-256, source reference, coverage, and status.
- 0 synthetic records in production assets; CI blocks `synthetic: true` in release manifests.
- 100% of displayed metrics have a source/method link in the UI.
- Initial app payload stays within the defined performance budget in the architecture document.
- All blocking acceptance tests pass before a production deploy.

## Content rules

- Use “observed comparison” only where the exact numerator, denominator, period, and filter are documented.
- Use “historical context” for asthma and NYCCAS layers.
- Use “modeled surface” for NYCCAS, never “monitor reading.”
- Use “approximate point” for CRZ detection-group coordinates.
- If evidence is unavailable, show `Not available for this claim`, not a fallback estimate.

## Scope boundary

```text
Included: public source data -> validated derivatives -> public exploration -> documented limits
Excluded: private data -> hidden model assumptions -> user data -> automated policy conclusions
```
