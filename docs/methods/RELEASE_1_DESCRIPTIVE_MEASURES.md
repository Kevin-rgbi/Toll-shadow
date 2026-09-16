# Release 1 Descriptive Measures

Release `2026-09-16.1` is limited to two source-specific, descriptive data
products. The full machine-readable specification is
`source/github-repo/pipeline/methods/release-1.yaml`.

## Policy Reference

The MTA states that Congestion Relief Zone tolling began on **2025-01-05**.
The release records that date only as a timeline marker. It does not split a
source into a treatment/control design, calculate an expected value, or make a
causal claim. Source: [MTA launch announcement](https://www.mta.info/press-release/new-york-joins-world-cities-launch-of-first-nation-program-deliver-cleaner-air-less).

## DOT Sampled Traffic Volume

- **Source:** `dot_automated_traffic_counts_archive_20260915`.
- **Coverage:** 2024-01-01 through 2025-12-31.
- **Unit:** observed vehicles in a sampled 15-minute DOT count.
- **Published grain:** street segment, borough, direction, and calendar month.
- **Metric:** `mean_observed_15_min_volume` equals the sum of valid observed volumes divided by the number of valid observations in that group.
- **Supporting fields:** maximum observed volume, observation count, distinct observed days, and count-session count.
- **Exclusion:** invalid records, including the archived `Vol = -1` sentinel, are not published. Null street labels remain null; they are never guessed.
- **Limit:** DOT count sessions are samples, not continuous measurement or full-year traffic totals.

## MTA Daily Facility Crossings

- **Source:** `mta_daily_bridge_tunnel_traffic_archive_20260915`.
- **Coverage:** 2024-01-01 through 2025-04-12, the end of the archived feed.
- **Unit:** vehicles per calendar-day, plaza, and direction.
- **Published grain:** one validated MTA daily aggregate per calendar date, toll plaza, and inbound/outbound direction.
- **Metrics:** `ezpass_vehicles`, `vtoll_vehicles`, `total_vehicles`, and `ezpass_share_pct` when `total_vehicles > 0`.
- **Limit:** this catalog view is a daily aggregate of the hourly source. It cannot support hourly analyses.

## Explicitly Excluded From Release 1

- CRZ detection-point summary: no reproducible raw-to-summary recipe.
- CBD taxi-zone derivative: geometry and release relationship not validated.
- DAC data: archived 2023 designation awaits an owner release decision.
- NYCCAS and asthma data: historical context only, never a current local or post-policy outcome.

No measure in this release supports a claim that congestion pricing caused,
prevented, predicted, or otherwise produced an observed change.
