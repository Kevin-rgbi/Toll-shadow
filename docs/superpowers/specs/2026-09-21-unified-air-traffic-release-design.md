# Unified 2025-2026 Air and Traffic Release

**Approved:** 2026-09-21  
**Target release:** `2026-09-21.1`

## Goal

Publish the supplied 2025-2026 NYCCAS PM2.5 and traffic observations through the existing verified-release architecture. Preserve the current editorial design, existing evidence modules, accessibility behavior, CI gates, historical context, and descriptive-only claim policy.

## Source And Derivation Design

The NYCCAS archive is the authoritative PM2.5 input. The derivation reads the pinned ZIP directly, validates its monthly files and station-location history, rejects duplicate site/timestamp records, and preserves every source UTC timestamp. Hourly output uses the location episode active at the observation timestamp and represents active-monitor gaps as null rather than zero.

Daily PM2.5 is grouped by `America/New_York` calendar day. Expected hours are derived from local midnight boundaries, so DST days contain 23, 24, or 25 expected hours. A day qualifies at 75 percent coverage: 18 hours for 23- or 24-hour days and 19 hours for 25-hour days. A day spanning a documented monitor relocation is retained with a relocation status but no daily mean.

Traffic derivation uses the supplied DOT snapshot and official MTA APIs. Fetching and aggregation must use explicit pagination or server-side grouped queries, record the queries and source row counts, and validate actual minimum and maximum timestamps. CRZ entries and excluded-roadway entries remain separate measures. Facility crossings remain separate from CRZ. No MTA point coordinates are published where coordinate provenance is unresolved. DOT observations remain explicitly sampled and are never forward-filled.

## Release Contract

Release `2026-09-21.1` publishes:

- sampled DOT traffic through its actual supplied coverage;
- official MTA facility-crossing aggregates;
- official CRZ entry aggregates with excluded-roadway counts separate;
- NYCCAS daily and hourly PM2.5 monitor measurements;
- the existing historical 2016 air surface, historical asthma context, and archived equity geography.

Each asset has a checksum, coverage window, grain, transform version, source IDs, and limitations. The browser continues to verify checksums before parsing. The release remains descriptive and does not make causal, exposure, hotspot, confidence, or health-effect claims.

## Product Behavior

AIR defaults to daily PM2.5 and loads hourly data only when requested. Both AIR and STORY can display monitor points and the measured-air timeline. Playback offers pause/play, previous, next, restart, scrubbing, and only `0.5x`, `1x`, `2x`, and `4x`. The map uses a fixed PM2.5 scale, stable legend, monitor tooltips, and an explicit no-observation state.

Air granularity and selected timestamp participate in URL state. Invalid or out-of-coverage values are clamped with a visible notice rather than silently changed. Historical black carbon, asthma, and equity remain optional, clearly dated context and are not substitutes for current PM2.5.

## Verification

Automated tests cover duplicate rejection, location episodes, relocation days, DST completeness, null gaps, API pagination/aggregation, CRZ separation, asthma-rate preservation, URL state, playback, and STORY/AIR rendering. Final verification includes lint, typecheck/build, unit and pipeline suites, accessibility gates, desktop and mobile end-to-end checks, representative-value audits, browser-console review, and a final deletion/regression diff review. Deployment is explicitly out of scope.
